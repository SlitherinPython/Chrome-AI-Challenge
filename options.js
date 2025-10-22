// Function to save the options to chrome.storage
function save_options() {
	// Get values from the form
	const findScholarships = document.getElementById("find-scholarships").checked;
	const findReviews = document.getElementById("find-reviews").checked;
	const researchLocation = document.getElementById("research-location").checked;
	const findAppTips = document.getElementById("find-app-tips").checked;

	const rateSociable = document.getElementById("rate-sociable").value;
	const rateNature = document.getElementById("rate-nature").value;
	const rateStudy = document.getElementById("rate-study").value;

	// Save them as a JavaScript object
	chrome.storage.sync.set(
		{
			prefs: {
				scholarships: findScholarships,
				reviews: findReviews,
				location: researchLocation,
				appTips: findAppTips,
				sociable: rateSociable,
				nature: rateNature,
				study: rateStudy,
			},
		},
		() => {
			// Show a "Saved!" message to the user for 1 second
			const status = document.getElementById("status-msg");
			status.style.display = "inline"; // Show the message
			setTimeout(() => {
				status.style.display = "none"; // Hide it
			}, 1000);
		}
	);
}

// Function to load the saved options when the page is opened
function restore_options() {
	// Get the 'prefs' object from storage.
	// We set default values for the very first time the user opens it.
	chrome.storage.sync.get(
		{
			prefs: {
				scholarships: true,
				reviews: true,
				location: false,
				appTips: false,
				sociable: 5,
				nature: 5,
				study: 5,
			},
		},
		(items) => {
			// Set the form elements to match the saved values
			const p = items.prefs;
			document.getElementById("find-scholarships").checked = p.scholarships;
			document.getElementById("find-reviews").checked = p.reviews;
			document.getElementById("research-location").checked = p.location;
			document.getElementById("find-app-tips").checked = p.appTips;

			document.getElementById("rate-sociable").value = p.sociable;
			document.getElementById("rate-nature").value = p.nature;
			document.getElementById("rate-study").value = p.study;
		}
	);
}

// Add event listeners once the page content is loaded
document.addEventListener("DOMContentLoaded", restore_options);
document.getElementById("save-btn").addEventListener("click", save_options);
