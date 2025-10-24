# UniCourse Helper: AI-Powered University Research Assistant

**Submission for the Google Chrome Built-in AI Challenge 2025**

UniCourse Helper is a Chrome extension designed to streamline the university research process for prospective students. Leveraging Chrome's built-in AI capabilities (Gemini Nano via the Prompt API) and a hybrid cloud architecture, it provides concise **summaries of university program pages subtly tailored to user preferences**, fetches relevant external links, and generates **personalized application tips based on user profile ratings**. It also includes a discovery feature to help users find potential universities based on their desired course and location.

---

## 🔥 Key Features

* **AI-Powered Page Analysis:** Instantly generates a concise summary of the current university course or program page using the on-device `LanguageModel` API. The summary subtly highlights aspects relevant to the user's self-rated **Sociable, Nature Lover, and Study Focused** profile settings.
* **Targeted External Link Discovery:** Utilizes a Firebase Cloud Function and the Google Custom Search API to find relevant, up-to-date links (up to 5 per category) for:
    * Scholarships & Financial Aid
    * Student Reviews (from sources like Reddit, forums)
    * Location Information (campus area, city life)
* **AI-Generated Application Tips:** Generates actionable application tips using the `LanguageModel` API, contextualized by the summarized page content and **tailored based on the user's profile ratings** (Sociable, Nature, Study).
* **University Discovery:** Searches for potential universities based on the user's specified course and location preferences, employing heuristics to filter for relevant program pages over generic results.
* **User Preference Customization:** Allows users to specify discovery criteria (course, location), toggle external information categories, and rate their personal profile (Sociable, Nature, Study) via a dedicated options page.
* **Hybrid Architecture:** Intelligently combines the privacy and speed benefits of on-device AI (summarization, tips generation) with the power of cloud functions (secure API key usage, external data fetching).
* **Clean Results Interface:** Presents all generated summaries and discovered links in a clearly organized new browser tab.

---

## 🚀 Workflow

1.  **Set Preferences:**
    * Right-click the extension icon -> "Options".
    * Enter your **Desired Course** and **Target Location** for discovery.
    * Toggle **External Research Features** (Scholarships, Reviews, Location, App Tips) for page analysis.
    * Adjust **Personal Profile** sliders (Sociable, Nature, Study) to influence AI prompt tailoring.
    * Click "Save Preferences".
2.  **Find Universities (Optional):**
    * Click extension icon -> "**Find Universities**".
    * A new tab lists potential university websites matching your course/location criteria.
3.  **Navigate & Analyze:**
    * Go to a specific university's course list/program page.
    * Click extension icon -> "**Analyze This Page**".
4.  **View Results:**
    * A new tab opens displaying:
        * An AI-generated summary of the current page (subtly reflecting profile ratings).
        * Lists of relevant external links (up to 5 per category).
        * AI-generated application tips tailored to the page content and profile ratings.

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