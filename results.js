console.log("Results: Script loaded.");

/**
 * Simple Markdown (**bold**, *italic*) to HTML (<b>, <i>) converter.
 * Also converts newlines to <br>.
 */
function markdownToHtml(text) {
	if (!text) return "";
	let html = text;
	html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>"); // Bold
	html = html.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, "<i>$1</i>"); // Italic
	html = html.replace(/\n/g, "<br>"); // Newlines
	return html;
}

/**
 * Updates a section designed to display text content.
 * @param {string} key - The storage key (e.g., 'pageSummary').
 * @param {string|null} content - The text content.
 */
function updateTextSection(key, content) {
	const loadingDiv = document.getElementById(`loading-${key}`);
	const contentDiv = document.getElementById(`${key}-content`);

	if (!contentDiv || !loadingDiv) {
		console.error(`Results: Could not find elements for text key: ${key}`);
		return;
	}

	if (content && content.trim() !== "" && !content.startsWith("[")) {
		// Check content exists and isn't an error msg
		console.log(
			`Results: Updating text section for ${key}. Length: ${content.length}`
		);
		loadingDiv.style.display = "none";
		contentDiv.innerHTML = markdownToHtml(content); // Apply formatting
	} else {
		const message =
			content && content.startsWith("[")
				? content
				: `No ${key
						.replace(/([A-Z])/g, " $1")
						.toLowerCase()} information was generated or requested.`;
		console.warn(`Results: No valid content for ${key}. Message: ${message}`);
		loadingDiv.innerText = message;
		loadingDiv.style.display = "block";
		contentDiv.innerHTML = "";
	}
}

/**
 * Updates a section designed to display a list of links.
 * @param {string} key - The storage key (e.g., 'scholarshipLinks').
 * @param {Array<{title: string, link: string}>|null} links - Array of link objects.
 */
function updateLinkSection(key, links) {
	const loadingDiv = document.getElementById(`loading-${key}`);
	const listElement = document.getElementById(`${key}-content`); // Expecting a <ul>

	if (!listElement || !loadingDiv) {
		console.error(`Results: Could not find elements for link key: ${key}`);
		return;
	}

	listElement.innerHTML = ""; // Clear previous links

	if (links && Array.isArray(links) && links.length > 0) {
		console.log(
			`Results: Updating link section for ${key}. Found ${links.length} links.`
		);
		loadingDiv.style.display = "none";

		links.forEach((item) => {
			const listItem = document.createElement("li");
			listItem.classList.add("list-group-item"); // Bootstrap class

			const linkAnchor = document.createElement("a");
			linkAnchor.href = item.link;
			linkAnchor.textContent = item.title || item.link; // Use title, fallback to link
			linkAnchor.target = "_blank"; // Open in new tab
			linkAnchor.rel = "noopener noreferrer"; // Security best practice

			listItem.appendChild(linkAnchor);
			listElement.appendChild(listItem);
		});
	} else {
		console.warn(`Results: No links found in storage for ${key}.`);
		loadingDiv.innerText = `No ${key
			.replace("Links", "")
			.replace(/([A-Z])/g, " $1")
			.toLowerCase()} links were found or requested.`;
		loadingDiv.style.display = "block";
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
		"scholarshipLinks",
		"reviewLinks",
		"locationLinks",
		"generatedAppTips", // Updated key name
	];

	console.log("Results: Getting keys from chrome.storage.local:", resultKeys);

	// Fetch all keys at once
	chrome.storage.local.get(resultKeys, (data) => {
		if (chrome.runtime.lastError) {
			console.error(
				"Results: Error getting data from storage:",
				chrome.runtime.lastError.message
			);
			// Show error in all sections (optional: could use a single error div)
			updateTextSection(
				"pageSummary",
				`Error loading data: ${chrome.runtime.lastError.message}`
			);
			updateLinkSection("scholarshipLinks", null); // Clear link sections
			updateLinkSection("reviewLinks", null);
			updateLinkSection("locationLinks", null);
			updateTextSection(
				"generatedAppTips",
				`Error loading data: ${chrome.runtime.lastError.message}`
			);
			return;
		}

		console.log("Results: Data retrieved from storage:", data);

		// Update each section using the appropriate helper
		updateTextSection("pageSummary", data.pageSummary);
		updateLinkSection("scholarshipLinks", data.scholarshipLinks);
		updateLinkSection("reviewLinks", data.reviewLinks);
		updateLinkSection("locationLinks", data.locationLinks);
		updateTextSection("generatedAppTips", data.generatedAppTips);
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
		// Check text keys
		if (changes.pageSummary) {
			updateTextSection("pageSummary", changes.pageSummary.newValue);
		}
		if (changes.generatedAppTips) {
			updateTextSection("generatedAppTips", changes.generatedAppTips.newValue);
		}

		// Check link keys
		if (changes.scholarshipLinks) {
			updateLinkSection("scholarshipLinks", changes.scholarshipLinks.newValue);
		}
		if (changes.reviewLinks) {
			updateLinkSection("reviewLinks", changes.reviewLinks.newValue);
		}
		if (changes.locationLinks) {
			updateLinkSection("locationLinks", changes.locationLinks.newValue);
		}
	}
});

console.log("Results: Load function and listener registered.");
