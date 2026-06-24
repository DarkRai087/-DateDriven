const axios = require("axios");

const BASE_URL = process.env.OPENF1_BASE_URL || "https://api.openf1.org/v1";

const openf1Client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    Accept: "application/json",
  },
});

/**
 * Fetch data from an OpenF1 endpoint.
 * @param {string} endpoint  - e.g. "/drivers"
 * @param {object} params    - query params forwarded to OpenF1
 * @returns {Promise<any[]>}
 */
async function fetchFromOpenF1(endpoint, params = {}) {
  // Strip out any undefined / empty values so we don't send noise to the API
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
  );

  const response = await openf1Client.get(endpoint, { params: cleanParams });
  return response.data;
}

module.exports = { fetchFromOpenF1 };
