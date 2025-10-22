// Function to save the options to chrome.storage.sync
function save_options() {
	// Get values from toggles
	const findScholarships = document.getElementById("find-scholarships").checked;
	const findReviews = document.getElementById("find-reviews").checked;
	const researchLocation = document.getElementById("research-location").checked;
	const findAppTips = document.getElementById("find-app-tips").checked;
    // Get discovery inputs
    const desiredCourse = document.getElementById("desired-course").value.trim();
    const targetLocation = document.getElementById("target-location").value.trim();
    // *** ADDED BACK: Get slider values ***
    const rateSociable = document.getElementById("rate-sociable").value;
    const rateNature = document.getElementById("rate-nature").value;
    const rateStudy = document.getElementById("rate-study").value;

	console.log("Options: Saving preferences...");

	// Save toggles, discovery inputs, AND slider values
	chrome.storage.sync.set(
		{
			prefs: {
                // Discovery fields
                course: desiredCourse,
                locationPref: targetLocation,
                // Analysis toggles
				scholarships: findScholarships,
				reviews: findReviews,
				location: researchLocation,
				appTips: findAppTips,
                // *** ADDED BACK: Slider values ***
                sociable: rateSociable,
                nature: rateNature,
                study: rateStudy,
			},
		},
		() => {
            if (chrome.runtime.lastError) { /* ... handle error ... */ }
            else {
                console.log("Options: Preferences saved successfully.");
                const status = document.getElementById("status-msg");
                status.style.display = "inline";
                setTimeout(() => { status.style.display = "none"; }, 1000);
            }
		}
	);
}

// Function to load the saved options
function restore_options() {
    console.log("Options: Restoring preferences...");
	chrome.storage.sync.get(
		{
			prefs: {
                // Discovery defaults
                course: "",
                locationPref: "",
                // Analysis defaults
				scholarships: true,
				reviews: true,
				location: false,
				appTips: true,
                // *** ADDED BACK: Slider defaults ***
                sociable: 5,
                nature: 5,
                study: 5,
			},
		},
		(items) => {
            if (chrome.runtime.lastError) { /* ... handle error ... */ return; }
			const p = items.prefs;
            console.log("Options: Loaded preferences:", p);

            // Restore discovery inputs
            document.getElementById("desired-course").value = p.course || "";
            document.getElementById("target-location").value = p.locationPref || "";

            // Restore toggles
			document.getElementById("find-scholarships").checked = !!p.scholarships;
			document.getElementById("find-reviews").checked = !!p.reviews;
			document.getElementById("research-location").checked = !!p.location;
			document.getElementById("find-app-tips").checked = !!p.appTips;

            // *** ADDED BACK: Restore slider values ***
            document.getElementById("rate-sociable").value = p.sociable || 5; // Use default if missing
            document.getElementById("rate-nature").value = p.nature || 5;
            document.getElementById("rate-study").value = p.study || 5;
		}
	);
}

document.addEventListener("DOMContentLoaded", restore_options);
document.getElementById("save-btn").addEventListener("click", save_options);