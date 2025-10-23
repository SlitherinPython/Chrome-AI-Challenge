# UniCourse Helper: AI-Powered University Research Assistant

**Submission for the Google Chrome Built-in AI Challenge 2025**

UniCourse Helper is a Chrome extension designed to streamline the university research process. Leveraging Chrome's built-in AI (Gemini Nano via the Prompt API) and a hybrid cloud architecture, it provides concise summaries of university program pages, finds relevant external links, generates AI-powered application tips, and helps discover universities based on user preferences.

---

## 🔥 Key Features

* **AI-Powered Page Analysis:** Instantly summarizes the current university course/program page using the on-device `LanguageModel` API, subtly tailored based on user profile settings.
* **Targeted External Link Discovery:** Finds relevant links for Scholarships, Student Reviews, and Location Info using a Firebase Cloud Function and the Google Custom Search API.
* **AI-Generated Application Tips:** Generates actionable application tips using the `LanguageModel` API, based on the page summary and user profile.
* **University Discovery:** Searches for potential universities based on the user's specified course and location, employing heuristics to filter for relevant program pages.
* **User Preference Customization:** Allows users to set discovery criteria and toggle external research features via an options page.
* **Hybrid Architecture:** Combines on-device AI (summarization, tips) with cloud functions (secure API calls, external search).
* **Clean Results Interface:** Presents summaries and links in an organized new browser tab.

---

## 🚀 Workflow

1.  **Set Preferences:** Right-click extension icon -> "Options" to set course/location for discovery and toggle analysis features. Save.
2.  **Find Universities (Optional):** Click extension icon -> "Find Universities". A new tab lists potential universities.
3.  **Navigate & Analyze:** Go to a specific university's course list/program page. Click extension icon -> "Analyze This Page".
4.  **View Results:** A new tab opens showing the AI page summary, relevant external links, and AI-generated application tips.

---

## 🛠️ Installation & Usage (Hackathon Judging Period)

During the hackathon judging period, the necessary backend Firebase Cloud Functions are deployed and active. Follow these steps to install and test the extension:

1.  **Clone/Download:** Obtain the project files from this repository.
2.  **Enable Chrome AI Features:**
    * Ensure you are using a compatible Chrome version (Canary recommended, 138+).
    * Navigate to `chrome://flags`.
    * Enable:
        * `#prompt-api-for-gemini-nano` -> `Enabled`
        * `#optimization-guide-on-device-model` -> `Enabled BypassPerfRequirement`
        * (Optional: `#prompt-api-for-gemini-nano-multimodal-input` -> `Enabled`)
    * **Relaunch** Chrome.
    * Navigate to `chrome://components`. Ensure "Optimization Guide On-Device Model" downloads successfully. Verify via `chrome://on-device-internals`. (See Troubleshooting below if issues arise).
3.  **Load Extension:**
    * Open Chrome/Canary -> `chrome://extensions`.
    * Enable **"Developer mode"**.
    * Click **"Load unpacked"** and select the extension's main folder (containing `manifest.json`).
    * Pin the extension icon.
4.  **Use:** Follow the [Workflow](#-workflow) section above. The extension will automatically call the pre-deployed Firebase functions.

---

## ⚙️ Self-Hosting/Deployment (Post-Hackathon or Independent Use)

If you want to run your own instance of the backend after the hackathon demo period, follow these steps:

1.  **Prerequisites:** Ensure you have Node.js, npm, and the Firebase CLI installed (`npm install -g firebase-tools`).
2.  **Firebase Project:**
    * Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/).
    * Upgrade the project to the **Blaze (Pay-as-you-go)** plan.
    * Set up a **Google Cloud Billing Budget Alert** (e.g., $1) with an action to disable billing for safety.
3.  **Google Cloud APIs:**
    * In the [Google Cloud Console](https://console.cloud.google.com/), select your Firebase project.
    * Enable the **"Custom Search API"** (or "Programmable Search Engine API").
    * Create an **API Key** ([APIs & Services -> Credentials](https://console.cloud.google.com/apis/credentials)). **Restrict this key** to *only* allow the "Custom Search API". Copy the key.
    * Create a **Programmable Search Engine** ([Control Panel](https://programmablesearchengine.google.com/controlpanel/all)), configure it to "Search the entire web", and copy its **Search engine ID**.
4.  **Configure Backend Code:**
    * Navigate to the `uni-helper-server/functions/` directory in your local copy of this repository.
    * Run `npm install` to install dependencies.
    * Open `index.js`. Replace the placeholder values for `GOOGLE_API_KEY` and `SEARCH_ENGINE_ID` with your *own* copied credentials.
5.  **Deploy Backend:**
    * In your terminal, navigate back to the `uni-helper-server` directory.
    * Log in: `firebase login`.
    * Initialize Firebase (if not done before for this folder): `firebase init functions` (select your project, JavaScript, say No to ESLint, Yes to install dependencies).
    * Deploy: `firebase deploy --only functions`.
    * Copy the two **Function URLs** outputted by the deploy command (`getExternalData` and `findUniversities`).
6.  **Configure Extension Code:**
    * Open the extension's `background.js` file.
    * Replace the placeholder URLs in the `EXTERNAL_DATA_FUNCTION_URL` and `FIND_UNIVERSITIES_FUNCTION_URL` constants with the URLs you copied after deployment.
7.  **Load & Run Extension:** Follow steps 2 & 3 from the "Installation & Usage (Hackathon Judging Period)" section above to enable AI features and load the unpacked extension.

---

## 🧗 Challenges Faced & Learnings

* **AI Model Setup:** Enabling the built-in AI (`LanguageModel`) was challenging. It required specific flag combinations (`BypassPerfRequirement` was key), dealing with corrupted model downloads (requiring manual deletion of component folders), diagnosing GPU block errors (necessitating driver updates), and understanding the component download lifecycle (`chrome://components`, `chrome://on-device-internals`). The namespace change from `chrome.ai.LanguageModel` to global `LanguageModel` in newer Chrome versions also required adaptation.
* **Service Worker Lifecycle:** The non-persistent nature of service workers caused initial "message channel closed" errors due to long-running asynchronous tasks (multiple AI calls, external fetches). Refactoring the communication pattern to a "fire-and-forget" model from the popup resolved this. The initial startup delay remains an inherent aspect.
* **Scraping Reliability:** Initial attempts to scrape external link content directly from the Firebase function proved unreliable due to varying website structures, anti-scraping measures, and non-HTML content (PDFs). Pivoting to fetch only link titles/URLs significantly improved speed and robustness.
* **API Key Security:** Implementing the hybrid model required careful separation of concerns to keep the Google API key secure within the cloud function and off the client-side code/GitHub.
* **Asynchronous Flow:** Managing the complex asynchronous flow involving user interaction, content script messaging, multiple AI calls, external API calls (Firebase), and storage operations required careful use of `async`/`await` and robust error handling.
---

## ✨ Future Enhancements

* Implement the **Translator API** for international users.
* Add a final **AI synthesis step** that incorporates user profile ratings more deeply, analyzing the page summary and *fetched link titles*.
* Refine the **university name extraction** logic.
* Improve **UI/UX** on the results pages.
* Explore using **streaming responses** from the `LanguageModel` API for perceived performance improvements.