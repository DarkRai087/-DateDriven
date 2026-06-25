const axios = require("axios");

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_BASE_URL = process.env.NEWS_API_BASE_URL || "https://newsapi.org/v2";

const newsApiClient = axios.create({
  baseURL: NEWS_API_BASE_URL,
  timeout: 10000,
});

async function fetchF1News(options = {}) {
  const {
    pageSize = 10,
    page = 1,
    sortBy = "publishedAt",
    language = "en",
  } = options;

  try {
    const response = await newsApiClient.get("/everything", {
      params: {
        q: '("Formula 1" OR "Formula One" OR "F1 racing") AND (driver OR race OR "Grand Prix" OR championship OR team)',
        domains: "formula1.com,autosport.com,motorsport.com,planetf1.com,crash.net,racefans.net,gpfans.com,espn.com,bbc.com,skysports.com",
        language,
        sortBy,
        pageSize,
        page,
        apiKey: NEWS_API_KEY,
      },
    });

    return response.data;
  } catch (err) {
    console.error("NewsAPI Error:", err.response?.data || err.message);
    throw err;
  }
}

async function fetchF1Headlines(options = {}) {
  const {
    pageSize = 10,
    page = 1,
    country = "us",
  } = options;

  try {
    const response = await newsApiClient.get("/top-headlines", {
      params: {
        q: "F1 OR Formula 1",
        category: "sports",
        country,
        pageSize,
        page,
        apiKey: NEWS_API_KEY,
      },
    });

    return response.data;
  } catch (err) {
    console.error("NewsAPI Headlines Error:", err.response?.data || err.message);
    throw err;
  }
}

module.exports = {
  fetchF1News,
  fetchF1Headlines,
};
