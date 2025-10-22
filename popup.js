// popup.js

document.addEventListener("DOMContentLoaded", () => {
	console.log("Popup: DOM loaded.");

	// Get references to all buttons and elements
	const summarizeBtn = document.getElementById("summarize-btn");
	const findUniversitiesBtn = document.getElementById("find-universities-btn");
	const optionsBtn = document.getElementById("options-btn");
	const statusMessage = document.getElementById("status-message");
	const loader = document.getElementById("loader");

	// --- Preferences Button Listener --- (Should be here)
	optionsBtn.addEventListener("click", () => {
		console.log("Popup: Options button clicked.");
		chrome.runtime.openOptionsPage(); // Opens options.html
	});

    // --- Analyze Page Button Listener --- (Should be here)
	summarizeBtn.addEventListener("click", () => {
        console.log("Popup: Analyze Page button clicked.");
        statusMessage.textContent = 'Starting analysis...';
        loader.style.display = 'flex';
        disableButtons(); // Helper to disable all buttons

        console.log("Popup: Sending SUMMARIZE_PAGE message to background script...");
        chrome.runtime.sendMessage({ type: "SUMMARIZE_PAGE" }, (response) => {
            handleBackgroundResponse(response); // Handle response
        });
    });

	// --- Find Universities Button Listener --- (Should be here)
	findUniversitiesBtn.addEventListener("click", async () => {
		console.log("Popup: Find Universities button clicked.");
		statusMessage.textContent = "Searching for universities...";
		loader.style.display = "flex";
		disableButtons(); // Helper to disable all buttons

		try {
            // Get discovery preferences (course, location)
            const items = await chrome.storage.sync.get({ prefs: { course: "", locationPref: "" } });
			const course = items.prefs.course;
			const location = items.prefs.locationPref;

			if (!course || !location) {
                statusMessage.textContent = "Please set desired course and location in Preferences first.";
                enableButtonsAndHideLoader();
                return;
            }

			console.log(`Popup: Sending FIND_UNIVERSITIES for course "${course}" in "${location}"...`);
			// Send message to background script
			chrome.runtime.sendMessage({
				type: "FIND_UNIVERSITIES",
				course: course,
				location: location
			}, (response) => {
				handleBackgroundResponse(response); // Use the same handler
			});

		} catch (error) { // Catch errors from storage.sync.get
			console.error("Popup: Error getting preferences before FIND_UNIVERSITIES:", error);
			statusMessage.textContent = `Error loading preferences: ${error.message}`;
			enableButtonsAndHideLoader();
		}
	}); // End findUniversitiesBtn listener

	// --- Helper function to disable buttons ---
    function disableButtons() {
        summarizeBtn.disabled = true;
        findUniversitiesBtn.disabled = true;
        optionsBtn.disabled = true;
    }

	// --- Helper function to re-enable buttons and hide loader ---
    function enableButtonsAndHideLoader() {
        loader.style.display = 'none';
        summarizeBtn.disabled = false;
        findUniversitiesBtn.disabled = false;
        optionsBtn.disabled = false;
    }

	// Helper function to handle responses from background script (for both actions)
	function handleBackgroundResponse(response) {
		if (chrome.runtime.lastError) {
			console.error("Popup: Error receiving response from background:", chrome.runtime.lastError.message);
			statusMessage.textContent = `Error: ${chrome.runtime.lastError.message}`;
		} else {
			console.log("Popup: Received response from background:", response);
			// Background script sends an immediate { status: "processing_started" }
			if (response && response.status === "processing_started") {
                 statusMessage.textContent = 'Processing started... Check new tab soon.';
                 // Keep buttons disabled until user closes popup or process finishes (buttons re-enable on next open)
                 // Or we could try enabling them after a short delay, assuming background started okay.
                 // For now, let's keep them disabled until popup closes.
                 // loader.style.display = 'none'; // Maybe hide loader now?
			} else if (response && response.success === false) { // Handle immediate failure from background
                statusMessage.textContent = response.data || 'Background script reported an error.';
                 console.error("Popup: Background script reported immediate error:", response.data);
            } else {
                // Should ideally only receive "processing_started" now
                console.warn("Popup: Received unexpected response from background:", response);
                 statusMessage.textContent = "Background acknowledged."; // Generic ack
            }
		}
        // Don't re-enable buttons right away in fire-and-forget, let popup close/reopen
        // enableButtonsAndHideLoader();
        // Maybe just hide loader after acknowledgment
        loader.style.display = 'none';
	} // End handleBackgroundResponse

	console.log("Popup: Event listeners added.");
}); // End DOMContentLoaded listener