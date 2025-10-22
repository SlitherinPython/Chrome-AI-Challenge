console.log("Background: Service worker started/restarted."); // Log startup

// URL for your Firebase function (ensure this is correct)
const EXTERNAL_DATA_FUNCTION_URL =
	"https://us-central1-uni-helper-hackathon.cloudfunctions.net/getExternalData";

// Main message listener - Handles messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log("Background: Received message:", request); // Log incoming message
	if (request.type === "SUMMARIZE_PAGE") {
		// This single button now triggers the full analysis
		handleFullAnalysis(sendResponse);
		return true; // Keep message channel open for async response
	}
	// Note: We removed the separate GET_EXTERNAL_DATA handler as it's merged
});

// --- Helper Functions ---

/**
 * Checks AI model availability. Throws error if unavailable/downloading.
 */
async function checkAiAvailability() {
	console.log("Background (Helper): Checking AI Availability...");
	if (
		typeof LanguageModel === "undefined" ||
		typeof LanguageModel.availability !== "function"
	) {
		throw new Error("Built-in AI Language Model interface is not available.");
	}
	// Check availability (using recommended syntax from EPP docs)
	const availability = await LanguageModel.availability();
	console.log(
		"Background (Helper): LanguageModel availability status:",
		availability
	);
	// Handle different states
	if (availability === "unavailable") {
		throw new Error("AI Model is unavailable. Check system requirements.");
	}
	if (availability === "downloading") {
		throw new Error("AI Model is still downloading. Please try again.");
	}
	console.log("Background (Helper): AI Model is available or downloadable.");
}

/**
 * Gets content from the content script of the active tab.
 * Returns { content: string, tabId: number, url: string }
 */
async function getPageContentFromActiveTab() {
	console.log("Background (Helper): Getting page content from active tab...");
	// Query for the active tab in the current window
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	// Validate tab information
	if (
		!tab ||
		!tab.id ||
		!tab.url ||
		(!tab.url.startsWith("http://") && !tab.url.startsWith("https://"))
	) {
		throw new Error("Could not get a valid active web page tab to scrape.");
	}
	console.log(`Background (Helper): Sending GET_PAGE_CONTENT to tab ${tab.id}`);
	// Send message to content script and await response
	const scrapeResponse = await chrome.tabs.sendMessage(tab.id, {
		type: "GET_PAGE_CONTENT",
	});
	// Validate response from content script
	if (!scrapeResponse?.success || !scrapeResponse.data) {
		throw new Error(
			scrapeResponse?.data || "Failed to get valid text content from the page."
		);
	}
	console.log(
		`Background (Helper): Received ${scrapeResponse.data.length} chars from content script.`
	);
	return { content: scrapeResponse.data, tabId: tab.id, url: tab.url }; // Return useful info
}

/**
 * Uses the AI model to generate a short summary of given text.
 * @param {string} textToSummarize - The text to be summarized.
 * @returns {Promise<string>} - The AI-generated summary.
 */
async function generateShortSummary(textToSummarize) {
	console.log(
		`Background (Helper): Generating short summary for text (${textToSummarize.length} chars)...`
	);
	if (!textToSummarize || textToSummarize.trim().length < 50) {
		// Avoid summarizing tiny texts
		console.warn(
			"Background (Helper): Text too short, skipping summary generation."
		);
		return "[Content too short to summarize meaningfully.]";
	}
	let session = null;
	try {
		// Create a session specifically for this summarization task
		session = await LanguageModel.create({
			expectedOutputs: [{ type: "text", languages: ["en"] }],
		});
		// Craft the prompt for a short paragraph summary
		const summaryPrompt = `Generate a concise, single-paragraph summary of the main points from the following text:\n\n${textToSummarize.substring(
			0,
			15000
		)}`; // Limit input size
		const summary = await session.prompt(summaryPrompt);
		console.log("Background (Helper): Short summary generated.");
		return summary;
	} catch (error) {
		console.error(
			"Background (Helper): Error generating short summary:",
			error
		);
		return `[Error generating summary: ${error.message}]`; // Return error message
	} finally {
		if (session) session.destroy(); // Clean up the session
	}
}

/**
 * Calls the Firebase function to get external data based on preferences.
 * @param {string} uniName - The name of the university.
 * @param {object} preferences - The user's preference object.
 * @returns {Promise<string>} - Raw text response from Firebase function.
 */
async function fetchExternalData(uniName, preferences) {
	console.log(
		"Background (Helper): Fetching external data from Firebase for:",
		uniName
	);
	// Validate function URL setup
	if (EXTERNAL_DATA_FUNCTION_URL.includes("YOUR_FIREBASE_FUNCTION_URL")) {
		throw new Error("Server function URL not configured in background.js.");
	}
	// Construct query parameters based on preferences
	const params = new URLSearchParams({
		uniName: uniName,
		scholarships: !!preferences.scholarships, // Ensure boolean-like values
		reviews: !!preferences.reviews,
		location: !!preferences.location,
		appTips: !!preferences.appTips,
		sociable: preferences.sociable || 5, // Default if undefined
		nature: preferences.nature || 5,
	});
	const functionUrlWithParams = `${EXTERNAL_DATA_FUNCTION_URL}?${params.toString()}`;
	console.log(
		"Background (Helper): Calling Firebase URL:",
		functionUrlWithParams
	);
	// Make the fetch request
	const response = await fetch(functionUrlWithParams);
	// Handle non-OK responses
	if (!response.ok) {
		let errorText = `Firebase function failed: ${response.status}`;
		try {
			errorText = await response.text();
		} catch (_) {}
		throw new Error(`Failed to fetch external data: ${errorText}`);
	}
	// Return the response text
	const externalDataText = await response.text();
	console.log(
		`Background (Helper): Received ${externalDataText.length} chars from Firebase.`
	);
	return externalDataText;
}

/**
 * Parses raw external text and summarizes/personalizes snippets using AI.
 * @param {string} rawExternalText - Text from Firebase function.
 * @param {string} uniName - University name for context.
 * @param {object} preferences - User preferences for personalization.
 * @returns {Promise<object>} - Object containing summarized text for each section.
 */
async function processExternalSnippets(rawExternalText, uniName, preferences) {
	console.log("Background (Helper): Processing external snippets...");
	// Initialize result object
	const results = {
		scholarshipSummary: "",
		reviewSummary: "",
		locationSummary: "",
		appTipsSummary: "",
	};
	// Split the raw text into sections based on "--- LABEL ---" format
	const sections = rawExternalText.split(/--- ([A-Z\s]+) ---/g).slice(1);

	// Process each section (label + content block)
	for (let i = 0; i < sections.length; i += 2) {
		const label = sections[i].trim();
		const contentBlock = sections[i + 1];
		// Split content block into individual snippets, clean them
		const snippets = contentBlock
			.split("---")
			.map((s) => s.trim())
			.filter((s) => s);

		if (snippets.length === 0) continue; // Skip if no snippets in section

		console.log(
			`Background (Helper): Processing ${snippets.length} snippets for ${label}...`
		);
		let sectionSummaries = [];

		// Process each snippet within the section sequentially
		for (const snippet of snippets) {
			// Skip invalid snippets
			if (
				snippet.includes("Could not retrieve content") ||
				snippet.length < 100 ||
				snippet.toUpperCase().startsWith("%PDF-")
			) {
				console.log(
					`Background (Helper): Skipping invalid snippet under ${label}.`
				);
				continue;
			}

			let session = null;
			try {
				// Base prompt for summarization
				let prompt = `Provide a very brief, concise summary (1-2 key sentences) of the following text snippet concerning ${label} at ${uniName}:\n\n${snippet.substring(
					0,
					5000
				)}`; // Limit snippet size in prompt

				// Add personalization instructions for Reviews and Location
				if (label === "STUDENT REVIEWS") {
					prompt += `\n\nAlso, comment briefly on how this might relate to a student who rates themselves as Sociable: ${preferences.sociable}/10 and Study Focused: ${preferences.study}/10.`;
				} else if (label === "LOCATION INFO") {
					prompt += `\n\nAlso, comment briefly on how this location information might relate to a student who rates themselves as Sociable: ${preferences.sociable}/10 and Nature Lover: ${preferences.nature}/10.`;
				}

				console.log(
					`Background (Helper): Creating session for ${label} snippet...`
				);
				session = await LanguageModel.create({
					expectedOutputs: [{ type: "text", languages: ["en"] }],
				});
				const snippetSummary = await session.prompt(prompt.substring(0, 15000)); // Limit overall prompt size
				sectionSummaries.push(snippetSummary);
				console.log(`Background (Helper): Processed snippet for ${label}.`);
			} catch (error) {
				console.error(
					`Background (Helper): Error processing snippet for ${label}:`,
					error
				);
				sectionSummaries.push(`[Could not process snippet: ${error.message}]`);
			} finally {
				if (session) session.destroy(); // Ensure session cleanup
			}
		} // End snippet loop

		// Assign combined summaries to the correct result key
		const combinedSectionSummary = sectionSummaries.join("\n\n").trim();
		switch (label) {
			case "SCHOLARSHIPS":
				results.scholarshipSummary = combinedSectionSummary;
				break;
			case "STUDENT REVIEWS":
				results.reviewSummary = combinedSectionSummary;
				break;
			case "LOCATION INFO":
				results.locationSummary = combinedSectionSummary;
				break;
			case "APPLICATION TIPS":
				results.appTipsSummary = combinedSectionSummary;
				break;
		}
	} // End section loop
	console.log("Background (Helper): Finished processing snippets.");
	return results;
}

/**
 * Saves results to storage and opens the results tab.
 * @param {object} results - Object containing summary strings.
 */
async function saveAndOpenResults(results) {
	console.log(
		"Background (Helper): Saving results to storage:",
		Object.keys(results)
	);
	await chrome.storage.local.set(results); // Save all keys passed in the object
	console.log("Background (Helper): Opening results tab...");
	await chrome.tabs.create({ url: chrome.runtime.getURL("results.html") }); // Open the results page
}

// --- Main Handler Function (Triggered by Popup) ---

/**
 * Orchestrates the full analysis process.
 */
async function handleFullAnalysis(sendResponse) {
	console.log("Background (Main): Starting full analysis...");
	let finalResults = {
		// Initialize object to hold final data for storage
		pageSummary: null,
		scholarshipSummary: null,
		reviewSummary: null,
		locationSummary: null,
		appTipsSummary: null,
		// We no longer need a separate 'recommendation' as personalization is in sections
	};
	let preferences = null;
	let pageData = null;

	try {
		// 1. Check AI Availability
		await checkAiAvailability();

		// 2. Fetch User Preferences
		console.log("Background (Main): Fetching user preferences...");
		const storedPrefs = await chrome.storage.sync.get({
			prefs: {
				// Default values
				scholarships: true,
				reviews: true,
				location: false,
				appTips: false,
				sociable: 5,
				nature: 5,
				study: 5,
			},
		});
		preferences = storedPrefs.prefs;
		console.log("Background (Main): Retrieved preferences:", preferences);

		// 3. Get and Summarize Current Page Content
		pageData = await getPageContentFromActiveTab();
		finalResults.pageSummary = await generateShortSummary(pageData.content);

		// 4. Fetch and Process External Data (if any preference is enabled)
		const needsExternalData =
			preferences.scholarships ||
			preferences.reviews ||
			preferences.location ||
			preferences.appTips;
		if (needsExternalData) {
			// Extract uniName
			const url = new URL(pageData.url);
			// Basic cleaning for uniName
			let uniName = url.hostname
				.replace(/^(www\.|ww2\.)/i, "")
				.split(".")
				.slice(0, -1)
				.join(".");
			uniName = uniName.replace(/\.(com|org|net|info|biz)$/i, "");
			uniName = uniName.replace(/\.(edu|ac)\.[a-z]{2}$/i, "");
			uniName = uniName.replace(/\.(edu|ac)$/i, "");
			uniName = uniName
				.split(/[\s-]+/)
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(" ");
			console.log(`Background (Main): Using uniName: ${uniName}`);

			const rawExternalText = await fetchExternalData(uniName, preferences);
			// Process snippets (summarize + personalize)
			const processedExternal = await processExternalSnippets(
				rawExternalText,
				uniName,
				preferences
			);
			// Merge processed results into finalResults
			finalResults = { ...finalResults, ...processedExternal };
		} else {
			console.log(
				"Background (Main): Skipping external data fetch based on preferences."
			);
		}

		// 5. Save all results and open the results tab
		await saveAndOpenResults(finalResults);

		// 6. Send success response back to popup
		sendResponse({
			success: true,
			message: "Analysis complete! Check the new tab.",
		});
		console.log("Background (Main): Full analysis successful.");
	} catch (error) {
		console.error("Background (Main): Error during full analysis:", error);
		// Send specific error message back to popup
		sendResponse({
			success: false,
			data: error.message || "An unknown error occurred during analysis.",
		});
	}
} // End handleFullAnalysis
