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
	const availability = await LanguageModel.availability();
	console.log(
		"Background (Helper): LanguageModel availability status:",
		availability
	);
	if (!["available", "readily", "downloadable"].includes(availability)) {
		throw new Error(
			`AI Model is currently ${availability}. Check system/flags.`
		);
	}
	console.log("Background (Helper): AI Model is available or downloadable.");
}

/**
 * Gets content from the content script of the active tab.
 * Returns { content: string, tabId: number, url: string }
 */
async function getPageContentFromActiveTab() {
	console.log("Background (Helper): Getting page content from active tab...");
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	if (
		!tab ||
		!tab.id ||
		!tab.url ||
		(!tab.url.startsWith("http://") && !tab.url.startsWith("https://"))
	) {
		throw new Error("Could not get a valid active web page tab to scrape.");
	}
	console.log(`Background (Helper): Sending GET_PAGE_CONTENT to tab ${tab.id}`);
	const scrapeResponse = await chrome.tabs.sendMessage(tab.id, {
		type: "GET_PAGE_CONTENT",
	});
	if (!scrapeResponse?.success || !scrapeResponse.data) {
		throw new Error(
			scrapeResponse?.data || "Failed to get valid text content from the page."
		);
	}
	console.log(
		`Background (Helper): Received ${scrapeResponse.data.length} chars from content script.`
	);
	return { content: scrapeResponse.data, tabId: tab.id, url: tab.url };
}

/**
 * Uses the AI model (Prompt API) to generate text based on a prompt.
 * Manages session creation and destruction.
 * @param {string} promptText - The prompt to send to the AI.
 * @param {string} taskDescription - A short description for logging (e.g., "page summary").
 * @returns {Promise<string>} - The AI-generated text.
 */
async function generateAiText(promptText, taskDescription) {
	console.log(
		`Background (Helper): Generating AI text for ${taskDescription}...`
	);
	if (!promptText || promptText.trim().length === 0) {
		console.warn(
			`Background (Helper): Empty prompt for ${taskDescription}, skipping AI call.`
		);
		return `[No input provided for ${taskDescription}.]`;
	}

	let session = null;
	try {
		console.log(
			`Background (Helper): Creating session for ${taskDescription}...`
		);
		session = await LanguageModel.create({
			expectedOutputs: [{ type: "text", languages: ["en"] }],
		});
		console.log(
			`Background (Helper): Prompting model for ${taskDescription}...`
		);
		// Limit prompt size going to the model
		const limitedPrompt = promptText.substring(0, 18000);
		const result = await session.prompt(limitedPrompt);
		console.log(
			`Background (Helper): AI generation successful for ${taskDescription}.`
		);
		return result;
	} catch (error) {
		console.error(
			`Background (Helper): Error generating AI text for ${taskDescription}:`,
			error
		);
		// Return specific error message if available
		return `[Error during ${taskDescription}: ${error.message}]`;
	} finally {
		if (session) {
			console.log(
				`Background (Helper): Destroying session for ${taskDescription}.`
			);
			session.destroy(); // Ensure session cleanup
		}
	}
}

/**
 * Calls the Firebase function to get external data links.
 * @param {string} uniName - The name of the university.
 * @param {object} preferences - The user's preference object.
 * @returns {Promise<object>} - Object containing lists of links { scholarshipLinks: [], reviewLinks: [], ... }.
 */
async function fetchExternalLinks(uniName, preferences) {
	console.log(
		"Background (Helper): Fetching external links from Firebase for:",
		uniName
	);
	if (EXTERNAL_DATA_FUNCTION_URL.includes("YOUR_FIREBASE_FUNCTION_URL")) {
		// Basic check
		throw new Error("Server function URL not configured in background.js.");
	}
	// Construct query parameters
	const params = new URLSearchParams({
		uniName: uniName,
		scholarships: !!preferences.scholarships,
		reviews: !!preferences.reviews,
		location: !!preferences.location,
		appTips: !!preferences.appTips,
		// Pass ratings even if not used by Firebase func, in case logic changes
		sociable: preferences.sociable || 5,
		nature: preferences.nature || 5,
	});
	const functionUrlWithParams = `${EXTERNAL_DATA_FUNCTION_URL}?${params.toString()}`;
	console.log(
		"Background (Helper): Calling Firebase URL:",
		functionUrlWithParams
	);

	const response = await fetch(functionUrlWithParams);
	if (!response.ok) {
		// Check for HTTP errors
		let errorText = `Firebase function failed: ${response.status}`;
		try {
			errorText = await response.text();
		} catch (_) {}
		throw new Error(`Failed to fetch external links: ${errorText}`);
	}
	// Try to parse the response as JSON
	try {
		const linksData = await response.json();
		console.log(
			"Background (Helper): Received links data from Firebase:",
			linksData
		);
		// Ensure all link arrays exist, even if empty
		return {
			scholarshipLinks: linksData.scholarshipLinks || [],
			reviewLinks: linksData.reviewLinks || [],
			locationLinks: linksData.locationLinks || [],
			appTipsLinks: linksData.appTipsLinks || [], // Make sure this key matches Firebase function's response
		};
	} catch (jsonError) {
		console.error(
			"Background (Helper): Failed to parse JSON response from Firebase:",
			jsonError
		);
		throw new Error("Received invalid data format from the server.");
	}
}

/**
 * Saves results to storage and opens the results tab.
 * @param {object} results - Object containing data for results page.
 */
async function saveAndOpenResults(results) {
	console.log(
		"Background (Helper): Saving results to storage:",
		Object.keys(results)
	);
	await chrome.storage.local.set(results); // Save all keys passed
	console.log("Background (Helper): Opening results tab...");
	await chrome.tabs.create({ url: chrome.runtime.getURL("results.html") }); // Open results.html
}

// --- Main Handler Function (Triggered by Popup) ---

/**
 * Orchestrates the full analysis process: page summary, link fetching, tips generation.
 */
async function handleFullAnalysis(sendResponse) {
	console.log("Background (Main): Starting full analysis...");
	// Initialize object to hold final data for storage
	let finalResults = {
		pageSummary: null,
		scholarshipLinks: [],
		reviewLinks: [],
		locationLinks: [],
		generatedAppTips: null, // Changed from appTipsLinks
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

		// 3. Get Current Page Content
		pageData = await getPageContentFromActiveTab();

		// 4. Generate AI Summary of Current Page
		finalResults.pageSummary = await generateAiText(
			pageData.content,
			"page summary"
		);

		// 5. Fetch External Links (if needed)
		const needsExternalData =
			preferences.scholarships ||
			preferences.reviews ||
			preferences.location ||
			preferences.appTips;
		let fetchedLinks = {
			scholarshipLinks: [],
			reviewLinks: [],
			locationLinks: [],
			appTipsLinks: [],
		}; // Default empty links

		if (needsExternalData) {
			// Extract uniName from URL
			const url = new URL(pageData.url);
			let uniName = url.hostname
				.replace(/^(www\.|ww2\.)/i, "")
				.split(".")
				.slice(0, -1)
				.join(".");
			// Basic cleaning
			uniName = uniName.replace(/\.(com|org|net|info|biz)$/i, "");
			uniName = uniName.replace(/\.(edu|ac)\.[a-z]{2}$/i, "");
			uniName = uniName.replace(/\.(edu|ac)$/i, "");
			uniName = uniName
				.split(/[\s-]+/)
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(" ");
			console.log(`Background (Main): Using uniName: ${uniName}`);

			// Call Firebase function to get links
			fetchedLinks = await fetchExternalLinks(uniName, preferences);

			// Store the fetched links directly in finalResults
			finalResults.scholarshipLinks = fetchedLinks.scholarshipLinks;
			finalResults.reviewLinks = fetchedLinks.reviewLinks;
			finalResults.locationLinks = fetchedLinks.locationLinks;
			// Note: We don't store appTipsLinks directly anymore, we generate tips instead.
		} else {
			console.log(
				"Background (Main): Skipping external link fetch based on preferences."
			);
		}

		// 6. Generate Application Tips using AI (based on page summary)
		// Only generate if the preference is on OR if links were found (optional refinement)
		if (preferences.appTips) {
			// Check preference
			const tipsPrompt = `Based on the following summary of a university program page, generate a few helpful application tips or key admission points a prospective student should consider. Be concise and use bullet points if appropriate:\n\n${finalResults.pageSummary}`;
			finalResults.generatedAppTips = await generateAiText(
				tipsPrompt,
				"application tips"
			);
		} else {
			console.log(
				"Background (Main): Skipping application tip generation based on preferences."
			);
			finalResults.generatedAppTips =
				"[Application tip generation disabled in preferences.]";
		}

		// 7. Save all generated/fetched results and open the results tab
		await saveAndOpenResults(finalResults);

		// 8. Send success response back to popup
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
