console.log("Results: Script loaded.");

/**
 * Simple Markdown (**bold**, *italic*) to HTML (<b>, <i>) converter.
 */
function markdownToHtml(text) {
	if (!text) return "";
	let html = text;
	// Bold: **text** -> <b>text</b> (non-greedy)
	html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
	// Italic: *text* -> <i>text</i> (non-greedy, careful with single asterisks)
	// Basic version, might need refinement if single asterisks are common in text
	html = html.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, "<i>$1</i>");
	// Convert newlines to <br> tags for HTML display
	html = html.replace(/\n/g, "<br>");
	return html;
}

/**
 * Helper to update a specific section in the results page.
 * @param {string} key - The storage key (e.g., 'pageSummary').
 * @param {string|null} content - The text content to display.
 */
function updateSection(key, content) {
	const loadingDiv = document.getElementById(`loading-${key}`);
	const contentDiv = document.getElementById(`${key}-content`);

	if (!contentDiv || !loadingDiv) {
		console.error(`Results: Could not find elements for key: ${key}`);
		return;
	}

	if (content && content.trim() !== "") {
		console.log(
			`Results: Updating section for ${key}. Length: ${content.length}`
		);
		loadingDiv.style.display = "none"; // Hide loading message
		contentDiv.innerHTML = markdownToHtml(content); // Apply formatting and set content
	} else {
		console.warn(`Results: No content found in storage for ${key}.`);
		// Display a user-friendly message if content is missing/empty
		loadingDiv.innerText = `No ${key
			.replace(/([A-Z])/g, " $1")
			.toLowerCase()} information was generated or requested.`;
		loadingDiv.style.display = "block"; // Ensure loading div is visible with message
		contentDiv.innerHTML = ""; // Clear any previous content
	}
}

/**
 * Load all result data from storage and display it.
 */
function loadResults() {
	console.log("Results: loadResults function called.");
	// Define the keys we expect from storage
	const resultKeys = [
		"pageSummary",
		"scholarshipSummary",
		"reviewSummary",
		"locationSummary",
		"appTipsSummary",
	];

	console.log("Results: Getting keys from chrome.storage.local:", resultKeys);

	// Fetch all keys at once
	chrome.storage.local.get(resultKeys, (data) => {
		if (chrome.runtime.lastError) {
			console.error(
				"Results: Error getting data from storage:",
				chrome.runtime.lastError.message
			);
			// Show error in all sections
			resultKeys.forEach((key) =>
				updateSection(
					key,
					`Error loading data: ${chrome.runtime.lastError.message}`
				)
			);
			return;
		}

		console.log("Results: Data retrieved from storage:", data);

		// Update each section using the helper function
		resultKeys.forEach((key) => {
			updateSection(key, data[key]); // Pass the content for the key (will be undefined if not found)
		});
	}); // End storage.local.get callback
} // End loadResults function

// Run loadResults when the page's DOM is ready
document.addEventListener("DOMContentLoaded", loadResults);

// Storage listener to update content if it changes while the tab is open
chrome.storage.onChanged.addListener((changes, area) => {
	console.log(
		"Results: storage.onChanged detected.",
		"Area:",
		area,
		"Changes:",
		changes
	);
	if (area === "local") {
		// Check each expected key and update if it changed
		const keysToCheck = [
			"pageSummary",
			"scholarshipSummary",
			"reviewSummary",
			"locationSummary",
			"appTipsSummary",
		];
		keysToCheck.forEach((key) => {
			if (changes[key]) {
				console.log(`Results: '${key}' changed. Updating display.`);
				updateSection(key, changes[key].newValue); // Use helper to update
			}
		});
	}
});

console.log("Results: Load function and listener registered.");
