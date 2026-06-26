const express = require("express");
const { fetchF1News, fetchF1Headlines, getNewsStatus, clearCache } = require("../services/newsapi");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: News
 *   description: F1 news articles from NewsAPI (updated daily)
 */

/**
 * @swagger
 * /news:
 *   get:
 *     summary: Get F1 news articles
 *     description: >
 *       Returns news articles related to Formula 1 from various sources.
 *       Articles are filtered to today's and yesterday's news.
 *       Results are cached for 30 minutes and refresh automatically each day.
 *     tags: [News]
 *     parameters:
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *         description: Number of articles to return
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [publishedAt, relevancy, popularity]
 *           default: publishedAt
 *         description: Sort order of articles
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Force refresh from API (bypass cache)
 *     responses:
 *       200:
 *         description: List of F1 news articles with update timestamp
 *       500:
 *         description: Failed to fetch news
 */
router.get("/", async (req, res) => {
  const pageSize = Math.min(Number(req.query.pageSize) || 10, 100);
  const page = Number(req.query.page) || 1;
  const sortBy = req.query.sortBy || "publishedAt";
  const forceRefresh = req.query.refresh === "true";

  try {
    const data = await fetchF1News({ pageSize, page, sortBy, forceRefresh });

    const articles = (data.articles || []).map((article) => ({
      title: article.title,
      description: article.description,
      content: article.content,
      url: article.url,
      urlToImage: article.urlToImage,
      publishedAt: article.publishedAt,
      source: {
        id: article.source?.id,
        name: article.source?.name,
      },
      author: article.author,
    }));

    res.json({
      status: "ok",
      totalResults: data.totalResults || 0,
      page,
      pageSize,
      articles,
      lastUpdated: data.lastUpdated || Date.now(),
      fromCache: data.fromCache || false,
      dateRange: data.dateRange || null,
      nextUpdate: data.fromCache 
        ? new Date(data.lastUpdated + 30 * 60 * 1000).toISOString()
        : new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const errorMessage = err.response?.data?.message || err.message;
    res.status(status).json({
      error: "Failed to fetch F1 news",
      details: errorMessage,
    });
  }
});

/**
 * @swagger
 * /news/status:
 *   get:
 *     summary: Get news cache status
 *     description: >
 *       Returns information about when news was last updated and when it will refresh next.
 *     tags: [News]
 *     responses:
 *       200:
 *         description: News cache status
 */
router.get("/status", (req, res) => {
  const status = getNewsStatus();
  res.json({
    ...status,
    lastUpdatedFormatted: status.lastUpdated 
      ? new Date(status.lastUpdated).toISOString() 
      : null,
    nextUpdate: status.lastUpdated 
      ? new Date(status.lastUpdated + 30 * 60 * 1000).toISOString()
      : "On next request",
    refreshSchedule: "Every 30 minutes or on new day",
  });
});

/**
 * @swagger
 * /news/refresh:
 *   post:
 *     summary: Force refresh news cache
 *     description: Clears the cache and fetches fresh news from NewsAPI.
 *     tags: [News]
 *     responses:
 *       200:
 *         description: Cache cleared and news refreshed
 */
router.post("/refresh", async (req, res) => {
  try {
    clearCache();
    const data = await fetchF1News({ pageSize: 10, forceRefresh: true });
    res.json({
      status: "ok",
      message: "News cache refreshed",
      lastUpdated: data.lastUpdated,
      articleCount: data.totalResults || 0,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to refresh news",
      details: err.message,
    });
  }
});

/**
 * @swagger
 * /news/headlines:
 *   get:
 *     summary: Get top F1 headlines
 *     tags: [News]
 */
router.get("/headlines", async (req, res) => {
  const pageSize = Math.min(Number(req.query.pageSize) || 10, 100);
  const page = Number(req.query.page) || 1;
  const country = req.query.country || "us";

  try {
    const data = await fetchF1Headlines({ pageSize, page, country });

    const articles = (data.articles || []).map((article) => ({
      title: article.title,
      description: article.description,
      content: article.content,
      url: article.url,
      urlToImage: article.urlToImage,
      publishedAt: article.publishedAt,
      source: {
        id: article.source?.id,
        name: article.source?.name,
      },
      author: article.author,
    }));

    res.json({
      status: "ok",
      totalResults: data.totalResults || 0,
      page,
      pageSize,
      articles,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    const errorMessage = err.response?.data?.message || err.message;
    res.status(status).json({
      error: "Failed to fetch F1 headlines",
      details: errorMessage,
    });
  }
});

module.exports = router;
