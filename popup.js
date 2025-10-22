document.addEventListener("DOMContentLoaded", () => {
	console.log("Popup: DOM loaded.");

	// Get references to elements
	const summarizeBtn = document.getElementById("summarize-btn");
	const optionsBtn = document.getElementById("options-btn");
	const statusMessage = document.getElementById("status-message");
	const loader = document.getElementById("loader");

	// --- Preferences Button Listener (No Change) ---
	optionsBtn.addEventListener("click", () => {
		console.log("Popup: Options button clicked.");
		chrome.runtime.openOptionsPage();
	});

	// --- Summarize/Analyze Button Listener (Handles Everything Now) ---
	summarizeBtn.addEventListener("click", () => {
		console.log("Popup: Analyze Page button clicked."); // Updated Log
		statusMessage.textContent = "Starting analysis..."; // Update initial status
		loader.style.display = "flex";
		summarizeBtn.disabled = true; // Disable button while working
		optionsBtn.disabled = true; // Disable options button too

		// Send the single message type to background.js
		console.log(
			"Popup: Sending SUMMARIZE_PAGE message to background script..."
		);
		chrome.runtime.sendMessage({ type: "SUMMARIZE_PAGE" }, (response) => {
			// Callback runs when background.js replies
			handleBackgroundResponse(response);
		});
	}); // End summarizeBtn click listener

	// --- External Data Button Listener Removed ---

	// Helper function to handle responses from background script
	function handleBackgroundResponse(response) {
		if (chrome.runtime.lastError) {
			console.error(
				"Popup: Error receiving response from background:",
				chrome.runtime.lastError.message
			);
			statusMessage.textContent = `Error: ${chrome.runtime.lastError.message}`;
		} else {
			console.log("Popup: Received response from background:", response);
			if (response && response.success) {
				statusMessage.textContent =
					response.message || "Analysis complete! Check the new tab."; // Use message from background
				console.log("Popup: Background script finished successfully.");
			} else {
				statusMessage.textContent =
					response.data || "An unknown error occurred during processing.";
				console.error(
					"Popup: Background script reported error:",
					response.data
				);
			}
		}
		// Re-enable buttons and hide loader regardless of success/failure
		loader.style.display = "none";
		summarizeBtn.disabled = false;
		optionsBtn.disabled = false;
	} // End handleBackgroundResponse

	console.log("Popup: Event listeners added.");
}); // End DOMContentLoaded listener
