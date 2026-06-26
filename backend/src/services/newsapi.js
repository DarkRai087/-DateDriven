const axios = require("axios");

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_BASE_URL = process.env.NEWS_API_BASE_URL || "https://newsapi.org/v2";

const newsApiClient = axios.create({
  baseURL: NEWS_API_BASE_URL,
  timeout: 15000,
});

// Cache to store news and avoid excessive API calls
let newsCache = {
  data: null,
  lastUpdated: null,
  lastCheckedDate: null,
};

const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

function getDateString(date = new Date()) {
  return date.toISOString().split("T")[0];
}

function getTodayDate() {
  return getDateString(new Date());
}

function getWeekAgoDate() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return getDateString(weekAgo);
}

function isCacheValid() {
  if (!newsCache.data || !newsCache.lastUpdated) return false;
  
  const now = Date.now();
  const cacheAge = now - newsCache.lastUpdated;
  const today = getTodayDate();
  
  // Invalidate cache if it's a new day or cache is too old
  if (newsCache.lastCheckedDate !== today) return false;
  if (cacheAge > CACHE_DURATION_MS) return false;
  
  return true;
}

async function fetchF1News(options = {}) {
  const {
    pageSize = 10,
    page = 1,
    sortBy = "publishedAt",
    language = "en",
    forceRefresh = false,
  } = options;

  // Check cache for first page requests
  if (page === 1 && !forceRefresh && isCacheValid()) {
    console.log(`[NewsAPI] Serving from cache (last updated: ${new Date(newsCache.lastUpdated).toISOString()})`);
    return {
      ...newsCache.data,
      fromCache: true,
      lastUpdated: newsCache.lastUpdated,
    };
  }

  try {
    const today = getTodayDate();
    const fromDate = getWeekAgoDate(); // Get news from last 7 days
    
    console.log(`[NewsAPI] Fetching fresh news from ${fromDate} to ${today}`);
    
    const response = await newsApiClient.get("/everything", {
      params: {
        q: '("Formula 1" OR "Formula One" OR "F1 racing") AND (driver OR race OR "Grand Prix" OR championship OR team)',
        domains: "formula1.com,autosport.com,motorsport.com,planetf1.com,crash.net,racefans.net,gpfans.com,espn.com,bbc.com,skysports.com",
        from: fromDate,
        to: today,
        language,
        sortBy,
        pageSize,
        page,
        apiKey: NEWS_API_KEY,
      },
    });

    const result = {
      ...response.data,
      fromCache: false,
      lastUpdated: Date.now(),
      dateRange: { from: fromDate, to: today },
    };

    // Update cache for first page
    if (page === 1) {
      newsCache = {
        data: response.data,
        lastUpdated: Date.now(),
        lastCheckedDate: today,
      };
      console.log(`[NewsAPI] Cache updated at ${new Date().toISOString()}`);
    }

    return result;
  } catch (err) {
    console.error("NewsAPI Error:", err.response?.data || err.message);
    
    // Return cached data if available when API fails
    if (newsCache.data) {
      console.log("[NewsAPI] API failed, returning stale cache");
      return {
        ...newsCache.data,
        fromCache: true,
        lastUpdated: newsCache.lastUpdated,
        stale: true,
      };
    }
    
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

function getNewsStatus() {
  return {
    cached: !!newsCache.data,
    lastUpdated: newsCache.lastUpdated,
    lastCheckedDate: newsCache.lastCheckedDate,
    cacheValid: isCacheValid(),
    articleCount: newsCache.data?.totalResults || 0,
  };
}

function clearCache() {
  newsCache = {
    data: null,
    lastUpdated: null,
    lastCheckedDate: null,
  };
  console.log("[NewsAPI] Cache cleared");
}

module.exports = {
  fetchF1News,
  fetchF1Headlines,
  getNewsStatus,
  clearCache,
};
