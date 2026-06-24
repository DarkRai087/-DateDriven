const express = require("express");
const { fetchFromOpenF1 } = require("../services/openf1");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Drivers
 *   description: Driver and team information from OpenF1
 */

/**
 * @swagger
 * /drivers:
 *   get:
 *     summary: Get drivers
 *     description: >
 *       Returns driver and team information. You can filter by session, driver
 *       number, or name acronym. If no filters are provided, results default to
 *       the latest available session.
 *     tags: [Drivers]
 *     parameters:
 *       - in: query
 *         name: session_key
 *         schema:
 *           type: integer
 *         description: Unique identifier for a session (e.g. 9839 for Abu Dhabi 2025 race)
 *       - in: query
 *         name: meeting_key
 *         schema:
 *           type: integer
 *         description: Unique identifier for a meeting (race weekend)
 *       - in: query
 *         name: driver_number
 *         schema:
 *           type: integer
 *         description: Official F1 car number (e.g. 44 for Hamilton, 1 for Verstappen)
 *       - in: query
 *         name: name_acronym
 *         schema:
 *           type: string
 *         description: Three-letter driver acronym (e.g. HAM, VER, LEC)
 *       - in: query
 *         name: team_name
 *         schema:
 *           type: string
 *         description: Full team name (e.g. "Red Bull Racing")
 *     responses:
 *       200:
 *         description: Array of driver objects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Driver'
 *       500:
 *         description: Failed to fetch data from OpenF1
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/", async (req, res) => {
  const { session_key, meeting_key, driver_number, name_acronym, team_name } =
    req.query;

  try {
    const data = await fetchFromOpenF1("/drivers", {
      session_key,
      meeting_key,
      driver_number,
      name_acronym,
      team_name,
    });
    res.json(data);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({
      error: "Failed to fetch drivers from OpenF1",
      details: err.message,
    });
  }
});

/**
 * @swagger
 * /drivers/{driver_number}:
 *   get:
 *     summary: Get a single driver by car number
 *     description: Returns driver info for a specific car number in the latest session.
 *     tags: [Drivers]
 *     parameters:
 *       - in: path
 *         name: driver_number
 *         required: true
 *         schema:
 *           type: integer
 *         description: Official F1 car number
 *       - in: query
 *         name: session_key
 *         schema:
 *           type: integer
 *         description: Filter by session (defaults to latest)
 *     responses:
 *       200:
 *         description: Driver object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Driver'
 *       404:
 *         description: Driver not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to fetch data from OpenF1
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:driver_number", async (req, res) => {
  const { driver_number } = req.params;
  const { session_key } = req.query;

  try {
    const data = await fetchFromOpenF1("/drivers", {
      driver_number,
      session_key,
    });

    if (!data || data.length === 0) {
      return res
        .status(404)
        .json({ error: `Driver #${driver_number} not found` });
    }

    // Return the most recent entry for this driver
    res.json(data[data.length - 1]);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({
      error: "Failed to fetch driver from OpenF1",
      details: err.message,
    });
  }
});

module.exports = router;
