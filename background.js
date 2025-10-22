console.log("Background: Service worker started/restarted.");

// URLs for your Firebase functions
const EXTERNAL_DATA_FUNCTION_URL = "https://us-central1-uni-helper-hackathon.cloudfunctions.net/getExternalData";
const FIND_UNIVERSITIES_FUNCTION_URL = "https://finduniversities-anctizd3ja-uc.a.run.app"; 

// Main message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log("Background: Received message:", request);
	if (request.type === "SUMMARIZE_PAGE") {
		// Acknowledge immediately
		sendResponse({ status: "processing_started" });
		// Start the analysis but don't pass sendResponse
		handleFullAnalysis();
		return false; // Indicate synchronous (or no further) response needed for this message channel
	} else if (request.type === "FIND_UNIVERSITIES") {
		// Acknowledge immediately
		sendResponse({ status: "processing_started" });
		// Start the university search but don't pass sendResponse
		handleFindUniversitiesRequest(request.course, request.location); // Pass course and location
		return false; // Indicate synchronous (or no further) response needed
	}
	// Optional: Handle unknown message types
	// else {
	//    console.warn("Background: Received unhandled message type:", request.type);
	//    sendResponse({ success: false, data: "Unhandled message type" });
	//    return false;
	// }
});

// --- Helper Functions (checkAiAvailability, getPageContentFromActiveTab, generateAiText, fetchExternalLinks, saveAndOpenResults) ---
// ... These helper functions remain the same as before ...
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
// --- Main Handler for Page Analysis ---
async function handleFullAnalysis() { // REMOVED sendResponse parameter
	console.log("Background (Main): Starting full analysis...");
	let finalResults = { /* ... initialize ... */ };
	let preferences = null;
	let pageData = null;

	try {
		// 1. Check AI Availability
		await checkAiAvailability();

		// 2. Fetch User Preferences (for analysis toggles AND user values)
		console.log("Background (Main): Fetching user preferences...");
		const storedPrefs = await chrome.storage.sync.get({ prefs: { /* ... defaults ... */ } });
		preferences = storedPrefs.prefs;
		console.log("Background (Main): Retrieved preferences:", preferences);

		// 3. Get Current Page Content
		pageData = await getPageContentFromActiveTab();

        // 4. Generate AI Summary of Current Page (with preferences)
        const pageSummaryPrompt = `Generate a concise, single-paragraph summary... Keep in mind the user describes themselves as Sociable: ${preferences.sociable}/10, Nature Lover: ${preferences.nature}/10, and Study Focused: ${preferences.study}/10; subtly highlight aspects relevant to these traits if prominent in the text:\n\n${pageData.content}`;
        finalResults.pageSummary = await generateAiText(pageSummaryPrompt, "page summary");

		// 5. Fetch External Links (if needed)
        // ... (Keep existing logic: check needsExternalData, extract uniName, call fetchExternalLinks) ...
		const needsExternalData = preferences.scholarships || preferences.reviews || preferences.location || preferences.appTips;
        let fetchedLinks = { /* ... default empty ... */ };
        if (needsExternalData) {
            const url = new URL(pageData.url);
            let uniName = url.hostname.replace(/^(www\.|ww2\.)/i, '').split('.').slice(0, -1).join('.');
			uniName = uniName.replace(/\.(com|org|net|info|biz)$/i, ''); // etc. cleaning...
			uniName = uniName.split(/[\s-]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            fetchedLinks = await fetchExternalLinks(uniName, preferences);
            finalResults.scholarshipLinks = fetchedLinks.scholarshipLinks;
            finalResults.reviewLinks = fetchedLinks.reviewLinks;
            finalResults.locationLinks = fetchedLinks.locationLinks;
        } else {
		    console.log("Background (Main): Skipping external link fetch...");
		}

        // 6. Generate Application Tips using AI (with preferences and context)
        if (preferences.appTips) {
             let tipsContext = `Page Summary:\n${finalResults.pageSummary}\n\n`;
             if (fetchedLinks.appTipsLinks && fetchedLinks.appTipsLinks.length > 0) { /* ... add link titles ... */ }
             const tipsPrompt = `Based on the summary... generate helpful application tips... Tailor the advice slightly considering the student rates themselves as Sociable: ${preferences.sociable}/10, Nature Lover: ${preferences.nature}/10, and Study Focused: ${preferences.study}/10... Use bullet points.\n\nContext:\n${tipsContext}`;
             finalResults.generatedAppTips = await generateAiText(tipsPrompt, "application tips");
        } else {
             console.log("Background (Main): Skipping application tip generation...");
             finalResults.generatedAppTips = "[Application tip generation disabled in preferences.]";
        }

		// 7. Save results and open the 'results.html' tab
		await saveAndOpenResults(finalResults); // This helper saves and opens results.html

		// 8. --- REMOVED sendResponse CALL ---
		console.log("Background (Main): Full analysis successful.");

	} catch (error) {
		console.error("Background (Main): Error during full analysis:", error);
        // Save error state for results.html to display
        await chrome.storage.local.set({ analysisError: error.message || "An unknown error occurred during analysis." });
        // Optionally open results tab even on error
        await chrome.tabs.create({ url: chrome.runtime.getURL("results.html"), active: true });
		// --- REMOVED sendResponse CALL ---
	}
} // End handleFullAnalysis


// --- **** NEW Handler for Finding Universities **** ---
/**
 * Handles the "Find Universities" button click.
 * Calls Firebase function with course/location, saves results, opens discovery tab.
 */
async function handleFindUniversitiesRequest(course, location) { // Receives course/location from message
    console.log(`Background (Discovery): Starting find universities request for "${course}" in "${location}"...`);

    // Basic validation
    if (!course || !location) {
        console.error("Background (Discovery): Missing course or location.");
        await chrome.storage.local.set({ discoveryError: "Course or location missing in request." });
        await chrome.tabs.create({ url: chrome.runtime.getURL("discovery_results.html"), active: true });
        return;
    }
    if (FIND_UNIVERSITIES_FUNCTION_URL.includes("YOUR_FIND_UNIVERSITIES_FUNCTION_URL")) {
        console.error("Background (Discovery): Find Universities Function URL is not set!");
        await chrome.storage.local.set({ discoveryError: "Server function URL not configured." });
        await chrome.tabs.create({ url: chrome.runtime.getURL("discovery_results.html"), active: true });
        return;
    }

    try {
        // 1. Construct the Function URL
        const params = new URLSearchParams({ course: course, location: location });
        const functionUrlWithParams = `${FIND_UNIVERSITIES_FUNCTION_URL}?${params.toString()}`;
        console.log("Background (Discovery): Calling Firebase function:", functionUrlWithParams);

        // 2. Call the Firebase function
        const response = await fetch(functionUrlWithParams);
        if (!response.ok) {
            let errorText = `Firebase function failed: ${response.status}`;
            try { errorText = await response.text(); } catch (_) {}
            throw new Error(`Failed to fetch university list: ${errorText}`);
        }

        // 3. Parse the JSON response (expecting { universities: [...] })
        let universityData;
         try {
            universityData = await response.json();
            if (!universityData || !Array.isArray(universityData.universities)) {
                 throw new Error("Invalid data format received from server (expected { universities: [...] }).");
            }
        } catch (jsonError) {
            console.error("Background (Discovery): Failed to parse JSON response:", jsonError);
            throw new Error("Received invalid data format from the server.");
        }
        console.log(`Background (Discovery): Received ${universityData.universities.length} university links.`);

        // 4. Save the list of universities to storage
        console.log("Background (Discovery): Saving university list to storage...");
        await chrome.storage.local.set({ foundUniversities: universityData.universities }); // Key: foundUniversities
        console.log("Background (Discovery): University list saved.");

        // 5. Open the new discovery results tab
        console.log("Background (Discovery): Opening discovery_results.html tab...");
        await chrome.tabs.create({ url: chrome.runtime.getURL("discovery_results.html"), active: true }); // New HTML page
        console.log("Background (Discovery): Discovery results tab opened.");

        // No sendResponse needed here due to fire-and-forget

    } catch (error) {
        console.error("Background (Discovery): Error during find universities request:", error);
        // Save error state for discovery_results.html to display
        await chrome.storage.local.set({ discoveryError: error.message || "An unknown error occurred finding universities." });
        // Optionally open discovery tab even on error
        await chrome.tabs.create({ url: chrome.runtime.getURL("discovery_results.html"), active: true });
        // No sendResponse needed here
    }
} // End handleFindUniversitiesRequest