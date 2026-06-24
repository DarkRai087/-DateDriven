const axios = require("axios");

const BASE_URL = process.env.ERGAST_BASE_URL || "https://api.jolpi.ca/ergast/f1";

const ergastClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { Accept: "application/json" },
});

/**
 * Fetch data from the Jolpica/Ergast F1 API.
 * @param {string} path   - e.g. "/2026.json" or "/2026/1/results.json"
 * @param {object} params - optional query params (limit, offset)
 * @returns {Promise<object>} raw MRData response
 */
async function fetchFromErgast(path, params = {}) {
  const response = await ergastClient.get(path, { params });
  return response.data.MRData;
}

module.exports = { fetchFromErgast };
