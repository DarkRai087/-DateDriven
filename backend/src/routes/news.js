const express = require("express");
const { fetchF1News, fetchF1Headlines } = require("../services/newsapi");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: News
 *   description: F1 news articles from NewsAPI
 */

/**
 * @swagger
 * /news:
 *   get:
 *     summary: Get F1 news articles
 *     description: >
 *       Returns news articles related to Formula 1 from various sources.
 *       Results are filtered to only include F1-related content.
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
 *     responses:
 *       200:
 *         description: List of F1 news articles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 totalResults:
 *                   type: integer
 *                 articles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/NewsArticle'
 *       500:
 *         description: Failed to fetch news
 */
router.get("/", async (req, res) => {
  const pageSize = Math.min(Number(req.query.pageSize) || 10, 100);
  const page = Number(req.query.page) || 1;
  const sortBy = req.query.sortBy || "publishedAt";

  try {
    const data = await fetchF1News({ pageSize, page, sortBy });

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
      error: "Failed to fetch F1 news",
      details: errorMessage,
    });
  }
});

/**
 * @swagger
 * /news/headlines:
 *   get:
 *     summary: Get top F1 headlines
 *     description: >
 *       Returns top headlines related to Formula 1 from sports category.
 *     tags: [News]
 *     parameters:
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *         description: Number of headlines to return
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *           default: us
 *         description: 2-letter country code for localized headlines
 *     responses:
 *       200:
 *         description: List of F1 top headlines
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 totalResults:
 *                   type: integer
 *                 articles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/NewsArticle'
 *       500:
 *         description: Failed to fetch headlines
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
