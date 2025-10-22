console.log("Content: Script injected."); // Added Log

/**
 * Listen for a message from the background script to start scraping.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log("Content: Received message:", request); // Added Log
	if (request.type === "GET_PAGE_CONTENT") {
		console.log(
			"Content: GET_PAGE_CONTENT request received. Starting scrape..."
		); // Added Log
		const content = scrapeCoursePageText();
		console.log(
			`Content: Scraping finished. Found ${
				content ? content.length : 0
			} characters.`
		); // Added Log

		if (content && content.length > 100) {
			console.log("Content: Sending successful response with data."); // Added Log
			sendResponse({ success: true, data: content });
		} else {
			console.warn(
				"Content: Sending failure response - not enough content found."
			); // Added Log
			sendResponse({
				success: false,
				data: "Could not find any relevant course content on this page.",
			});
		}
	} else {
		console.warn("Content: Received unhandled message type:", request.type); // Added Log
	}

	// Keep message channel open for asynchronous response (good practice, though may not be strictly needed here)
	return true;
});

console.log("Content: Message listener added."); // Added Log

/**
 * Scraper function (Added logs inside)
 */
function scrapeCoursePageText() {
	console.log("Content: Starting scrapeCoursePageText function..."); // Added Log
	let mainArea =
		document.querySelector("main") ||
		document.querySelector('[role="main"]') ||
		document.body;
	if (!mainArea) {
		console.warn(
			"Content: Could not find <main> or [role='main'], using document.body."
		); // Added Log
		mainArea = document.body;
	} else {
		console.log("Content: Found main content area:", mainArea.tagName); // Added Log
	}

	const contentClone = mainArea.cloneNode(true);
	console.log("Content: Cloned main area."); // Added Log

	// Remove noisy elements
	const removedCount = contentClone.querySelectorAll(
		"nav, header, footer, aside, .sidebar, .menu, form, button, script, style, noscript, svg, img, video, audio, iframe"
	).length;
	contentClone
		.querySelectorAll(
			"nav, header, footer, aside, .sidebar, .menu, form, button, script, style, noscript, svg, img, video, audio, iframe"
		)
		.forEach((el) => el.remove());
	console.log(`Content: Removed ${removedCount} noisy elements.`); // Added Log

	let allText = "";
	const potentialTitles = contentClone.querySelectorAll("h3, h4");
	console.log(
		`Content: Found ${potentialTitles.length} potential title elements (h3/h4).`
	); // Added Log

	potentialTitles.forEach((title, index) => {
		const titleText = title.innerText.trim();
		const nextEl = title.nextElementSibling;

		if (nextEl && (nextEl.tagName === "P" || nextEl.tagName === "DIV")) {
			const descText = nextEl.innerText.trim();
			if (titleText.length > 2 && descText.length > 25) {
				// Log only the first few found pairs to avoid flooding console
				if (index < 5)
					console.log(
						`Content: Found potential course - Title: "${titleText.substring(
							0,
							30
						)}...", Desc: "${descText.substring(0, 50)}..."`
					);
				allText += `Course: ${titleText}\nDescription: ${descText}\n\n`;
			}
		}
	});

	if (allText.length < 100) {
		console.warn(
			"Content: Primary scraping strategy (h3/h4 + p/div) found less than 100 chars. Falling back to innerText of cleaned clone."
		); // Added Log
		allText = contentClone.innerText.replace(/\s\s+/g, "\n").trim(); // Attempt to clean up whitespace from innerText
	} else {
		console.log("Content: Primary scraping strategy successful."); // Added Log
	}

	const finalText = allText.substring(0, 15000); // Limit size
	console.log(`Content: Final text length before sending: ${finalText.length}`); // Added Log
	return finalText;
}
