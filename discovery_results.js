console.log("Discovery Results: Script loaded.");

/**
 * Load university list or error message from storage and display it.
 */
function loadDiscoveryResults() {
  console.log("Discovery Results: loadDiscoveryResults function called.");
  const loadingDiv = document.getElementById('loading-universities');
  const errorDiv = document.getElementById('discovery-error');
  const listElement = document.getElementById('universities-list-content');

  // Clear previous state
  listElement.innerHTML = '';
  errorDiv.style.display = 'none';
  loadingDiv.style.display = 'block'; // Ensure loading is visible initially

  console.log("Discovery Results: Getting 'foundUniversities' and 'discoveryError' from storage...");

  // Fetch both keys
  chrome.storage.local.get(['foundUniversities', 'discoveryError'], (data) => {
    if (chrome.runtime.lastError) {
        console.error("Discovery Results: Error getting data from storage:", chrome.runtime.lastError.message);
        loadingDiv.style.display = 'none';
        errorDiv.textContent = `Error loading results: ${chrome.runtime.lastError.message}`;
        errorDiv.style.display = 'block';
        return;
    }

    console.log("Discovery Results: Data retrieved from storage:", data);

    // Check if an error was saved by the background script
    if (data && data.discoveryError) {
        console.error("Discovery Results: Discovery error detected from background:", data.discoveryError);
        loadingDiv.style.display = 'none';
        errorDiv.textContent = `Search Failed: ${data.discoveryError}`;
        errorDiv.style.display = 'block';
        // Clear the error from storage so it doesn't show next time
        chrome.storage.local.remove('discoveryError');
        return; // Stop processing
    }

    // Check if university list exists and is valid
    if (data && data.foundUniversities && Array.isArray(data.foundUniversities)) {
        const universities = data.foundUniversities;

        if (universities.length > 0) {
            console.log(`Discovery Results: Found ${universities.length} universities. Populating list.`);
            loadingDiv.style.display = 'none'; // Hide loading indicator

            universities.forEach(uni => {
                const listItem = document.createElement('li');
                listItem.classList.add('list-group-item'); // Bootstrap class

                const linkAnchor = document.createElement('a');
                linkAnchor.href = uni.link;
                // Use title, fallback to displayLink, fallback to link itself
                linkAnchor.textContent = uni.title || uni.displayLink || uni.link;
                linkAnchor.target = '_blank'; // Open in new tab
                linkAnchor.rel = 'noopener noreferrer';

                // Optionally add the display link/hostname if different from title
                if (uni.displayLink && uni.displayLink !== linkAnchor.textContent) {
                    const domainSpan = document.createElement('span');
                    domainSpan.textContent = ` (${uni.displayLink})`;
                    domainSpan.style.fontSize = '0.9em';
                    domainSpan.style.color = '#6c757d'; // Muted color
                    linkAnchor.appendChild(domainSpan);
                }

                listItem.appendChild(linkAnchor);
                listElement.appendChild(listItem);
            });
        } else {
            console.log("Discovery Results: foundUniversities array is empty.");
            loadingDiv.innerText = 'No universities found matching your criteria. Try broadening your course or location search in Preferences.';
        }
        // Clear the university list from storage after displaying? Optional.
        // chrome.storage.local.remove('foundUniversities');
    } else {
        // This case might happen if background script finished but somehow didn't save data
        console.warn("Discovery Results: No valid university data found in storage.");
        loadingDiv.innerText = 'Could not retrieve university list. Please try the search again.';
    }
  }); // End storage.get callback
} // End loadDiscoveryResults

// Run loadResults when the page's DOM is ready
document.addEventListener('DOMContentLoaded', loadDiscoveryResults);

// Optional: Add a storage listener if you want the page to potentially update
// if a *new* search finishes while this tab is open (less common use case).
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.foundUniversities || changes.discoveryError)) {
        console.log("Discovery Results: Storage changed, reloading results...");
        loadDiscoveryResults(); // Reload the list if relevant data changes
    }
});