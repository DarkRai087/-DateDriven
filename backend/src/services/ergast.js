const axios = require("axios");
const { cacheThrough } = require("./cache");

const BASE_URL = process.env.ERGAST_BASE_URL || "https://api.jolpi.ca/ergast/f1";

const ergastClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { Accept: "application/json" },
});

/**
 * Determine cache TTL based on data type.
 * - Historical data (past years): 24 hours
 * - Current year schedule: 1 hour
 * - Current year results: 5 minutes (could change during race weekend)
 */
function getCacheTTL(path) {
  const currentYear = new Date().getFullYear();
  const yearMatch = path.match(/\/(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : currentYear;

  if (year < currentYear) {
    return 86400; // 24 hours for historical data
  }

  if (path.includes("/results") || path.includes("/qualifying") || path.includes("/sprint")) {
    return 300; // 5 minutes for live results
  }

  return 3600; // 1 hour for current year schedule
}

/**
 * Fetch data from the Jolpica/Ergast F1 API with caching.
 * @param {string} path   - e.g. "/2026.json" or "/2026/1/results.json"
 * @param {object} params - optional query params (limit, offset)
 * @returns {Promise<object>} raw MRData response
 */
async function fetchFromErgast(path, params = {}) {
  const cacheKey = `ergast:${path}:${JSON.stringify(params)}`;
  const ttl = getCacheTTL(path);

  return cacheThrough(
    cacheKey,
    async () => {
      const response = await ergastClient.get(path, { params });
      return response.data.MRData;
    },
    ttl
  );
}

/**
 * Raw fetch without caching (for cases where fresh data is needed).
 */
async function fetchFromErgastRaw(path, params = {}) {
  const response = await ergastClient.get(path, { params });
  return response.data.MRData;
}

module.exports = { fetchFromErgast, fetchFromErgastRaw };
