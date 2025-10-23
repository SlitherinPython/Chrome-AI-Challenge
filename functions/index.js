const functions = require("firebase-functions");
const axios = require("axios");
const cors = require("cors")({ origin: true });

// --- Add your credentials ---
// WARNING: Use a NEW, non-exposed API key and keep it private!
const GOOGLE_API_KEY = "YOUR_GOOGLE_API_KEY"; // Replace with your regenerated key
const SEARCH_ENGINE_ID = "YOUR_SEARCH_ENGINE_KEY";
// ---

/**
 * Extracts a base domain name from a URL for grouping results.
 * @param {string} url - The URL string.
 * @returns {string|null} - The extracted domain name or null if invalid.
 */
function getDomainName(url) {
	try {
		const hostname = new URL(url).hostname;
		// Basic attempt to get main domain parts (e.g., example.com, example.ac.uk)
		const parts = hostname.split(".");
		if (parts.length >= 2) {
			// Handle common academic TLDs like ac.uk, edu.au etc.
			if (
				(parts[parts.length - 2] === "ac" ||
					parts[parts.length - 2] === "edu") &&
				parts.length >= 3
			) {
				return parts.slice(-3).join(".");
			}
			return parts.slice(-2).join(".");
		}
		return hostname; // Fallback
	} catch (e) {
		console.error(`Error parsing domain from URL: ${url}`, e);
		return null; // Invalid URL
	}
}

/**
 * Helper function to perform a single Google search and return {title, link, displayLink} pairs.
 * @param {string} query - The search query.
 * @param {number} [numResults=5] - Number of results to fetch (max 10).
 * @returns {Promise<Array<{title: string, link: string, displayLink: string}>>} - Array of result objects.
 */
async function performSearchAndGetLinks(query, numResults = 5) {
	const actualNumResults = Math.min(numResults, 10); // Respect API limit
	console.log(
		`Searching Google for: "${query}" (requesting ${actualNumResults} results)...`
	);
	// Ensure credentials are set
	if (GOOGLE_API_KEY.includes("YOUR_")) {
		console.error("API Key placeholder still present.");
		throw new Error("Server configuration error: API Key not set.");
	}
	if (SEARCH_ENGINE_ID.includes("YOUR_")) {
		console.error("Search Engine ID placeholder still present.");
		throw new Error("Server configuration error: Search Engine ID not set.");
	}

	const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(
		query
	)}&num=${actualNumResults}`;
	try {
		const searchResponse = await axios.get(searchUrl);
		const items = searchResponse.data.items || [];
		// Extract title, link, and displayLink
		return items.map((item) => ({
			title: item.title,
			link: item.link,
			displayLink: item.displayLink || getDomainName(item.link) || "", // Use helper, provide fallback
		}));
	} catch (error) {
		console.error(
			`Google Search failed for query "${query}":`,
			error.response ? error.response.data : error.message
		);
		if (error.response && [400, 403].includes(error.response.status)) {
			let errorDetail =
				error.response.data?.error?.message ||
				`Status code ${error.response.status}`;
			console.error(
				`Google Search API permission/config error: ${errorDetail}`
			);
			throw new Error(
				`Permission or configuration error with Google Search API. Please check server logs.`
			);
		}
		return []; // Return empty array on other errors
	}
}

// --- Function to get links for a SPECIFIC Uni ---
exports.getExternalData = functions.https.onRequest((request, response) => {
	cors(request, response, async () => {
		console.log("Function (getExternalData) received request:", request.query);
		const uniName = request.query.uniName;
		// Validation
		if (!uniName) {
			return response.status(400).send("Missing 'uniName' query parameter.");
		}
		if (
			GOOGLE_API_KEY.includes("YOUR_") ||
			SEARCH_ENGINE_ID.includes("YOUR_")
		) {
			return response
				.status(500)
				.send(
					"Server configuration error: API credentials placeholders detected."
				);
		}

		// Get preferences
		const findScholarships = request.query.scholarships === "true";
		const findReviews = request.query.reviews === "true";
		const findLocationInfo = request.query.location === "true";
		const findAppTips = request.query.appTips === "true";

		// Build search tasks
		const searchTasks = [];
		const numLinksToFetch = 5; // Fetch 5 links for analysis

		if (findScholarships) {
			searchTasks.push(
				performSearchAndGetLinks(
					`"${uniName}" scholarships OR financial aid`,
					numLinksToFetch
				)
			);
		} else {
			searchTasks.push(Promise.resolve([]));
		}
		if (findReviews) {
			searchTasks.push(
				performSearchAndGetLinks(
					`"${uniName}" student reviews reddit OR student life forum OR quora`,
					numLinksToFetch
				)
			);
		} else {
			searchTasks.push(Promise.resolve([]));
		}
		if (findLocationInfo) {
			const locationQuery = `"${uniName}" city OR area information OR campus location`;
			searchTasks.push(
				performSearchAndGetLinks(locationQuery, numLinksToFetch)
			);
		} else {
			searchTasks.push(Promise.resolve([]));
		}
		if (findAppTips) {
			searchTasks.push(
				performSearchAndGetLinks(
					`"${uniName}" application tips OR admission requirements OR how to apply undergraduate`,
					numLinksToFetch
				)
			);
		} else {
			searchTasks.push(Promise.resolve([]));
		}

		try {
			// Execute searches
			console.log(`Executing searches for ${uniName}...`);
			const [scholarshipLinks, reviewLinks, locationLinks, appTipsLinks] =
				await Promise.all(searchTasks);
			console.log(`Searches complete for ${uniName}.`);
			// Prepare and send JSON response
			const results = {
				scholarshipLinks: scholarshipLinks || [],
				reviewLinks: reviewLinks || [],
				locationLinks: locationLinks || [],
				appTipsLinks: appTipsLinks || [],
			};
			console.log("Sending link results back to extension:", results);
			response.status(200).json(results);
		} catch (error) {
			console.error(`Error during link fetching for ${uniName}:`, error);
			response
				.status(500)
				.send(`An error occurred while fetching links: ${error.message}`);
		}
	}); // End CORS wrapper
}); // End getExternalData function

// --- Function to FIND Universities (with Filtering) ---
exports.findUniversities = functions.https.onRequest((request, response) => {
	cors(request, response, async () => {
		console.log("Function (findUniversities) received request:", request.query);

		// Get parameters
		const course = request.query.course;
		const location = request.query.location;
		const initialNumResults = 15; // Fetch more initially for filtering
		const maxFilteredResults = 10; // Return up to 10 filtered

		// Validation
		if (!course || !location) {
			return response
				.status(400)
				.send("Missing 'course' or 'location' query parameters.");
		}
		if (
			GOOGLE_API_KEY.includes("YOUR_") ||
			SEARCH_ENGINE_ID.includes("YOUR_")
		) {
			return response
				.status(500)
				.send(
					"Server configuration error: API credentials placeholders detected."
				);
		}

		// Build specific search query
		const searchQuery = `"${course}" bachelor OR undergraduate program OR degree site:.edu OR site:.ac "${location}" -filetype:pdf`;

		try {
			// Execute initial search
			console.log(
				`Executing Google search for university programs: ${searchQuery}`
			);
			const initialLinks = await performSearchAndGetLinks(
				searchQuery,
				initialNumResults
			);
			console.log(
				`Initial search complete. Found ${initialLinks.length} potential links.`
			);

			// Filter results using heuristics
			const filteredLinks = [];
			const seenDomains = new Set();

			for (const link of initialLinks) {
				if (filteredLinks.length >= maxFilteredResults) break;

				const lowerCaseTitle = link.title.toLowerCase();
				const lowerCaseUrl = link.link.toLowerCase();
				const domain = getDomainName(link.link); // Use helper

				if (!domain || seenDomains.has(domain)) continue; // Skip duplicates or invalid

				// --- Heuristics ---
				if (
					lowerCaseTitle.includes("top universities") ||
					lowerCaseTitle.includes("best schools") ||
					lowerCaseTitle.includes("ranking") ||
					lowerCaseTitle.includes("list of")
				) {
					console.log(`Filtering out (list): ${link.title}`);
					continue; // Skip listicles
				}
				const urlPath = new URL(link.link).pathname;
				if (
					urlPath === "/" ||
					urlPath === "/index.html" ||
					urlPath === "/home" ||
					urlPath.length < 2
				) {
					console.log(`Filtering out (homepage): ${link.title}`);
					continue; // Skip likely homepages
				}
				const pathKeywords = [
					"program",
					"course",
					"degree",
					"major",
					"academic",
					"study",
					"faculty",
					"school",
					"department",
					"admission",
				];
				const hasPathKeyword = pathKeywords.some((keyword) =>
					lowerCaseUrl.includes(`/${keyword}`)
				); // Look for keywords in path segments
				const titleMentionsCourse = lowerCaseTitle.includes(
					course.toLowerCase()
				);

				if (hasPathKeyword || titleMentionsCourse) {
					filteredLinks.push(link);
					seenDomains.add(domain);
				} else {
					console.log(
						`Filtering out (heuristic): ${link.title} (${link.link})`
					);
				}
			}
			console.log(
				`Filtered down to ${filteredLinks.length} potential course page links.`
			);

			// Prepare and send JSON response
			const results = {
				universities: filteredLinks, // Send the filtered list
			};

			if (results.universities.length === 0) {
				console.log("No university links passed filtering for the criteria.");
			}

			console.log(
				"Sending filtered university link results back to extension:",
				results
			);
			response.status(200).json(results);
		} catch (error) {
			console.error("Error during university finding:", error);
			response
				.status(500)
				.send(`An error occurred while finding universities: ${error.message}`);
		}
	}); // End CORS wrapper
}); // End findUniversities function
