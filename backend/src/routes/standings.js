const express = require("express");
const { fetchFromErgast } = require("../services/ergast");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Standings
 *   description: Driver and constructor championship standings via Jolpica/Ergast
 */

// ─── Driver Standings ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /standings/{year}/drivers:
 *   get:
 *     summary: Get driver championship standings for a season
 *     description: >
 *       Returns the driver standings at the end of (or latest point in)
 *       the given season. The frontend calls this when the year tab is toggled.
 *     tags: [Standings]
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *         description: F1 season year (e.g. 2026)
 *     responses:
 *       200:
 *         description: Array of driver standing entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 season:
 *                   type: string
 *                 round:
 *                   type: integer
 *                 standings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DriverStanding'
 *       404:
 *         description: No standings found for that year
 *       500:
 *         description: Upstream fetch failed
 */
router.get("/:year/drivers", async (req, res) => {
  const { year } = req.params;

  try {
    const data = await fetchFromErgast(`/${year}/driverStandings.json`, {
      limit: 30,
    });
    const list = data.StandingsTable?.StandingsLists?.[0];

    if (!list) {
      return res
        .status(404)
        .json({ error: `No driver standings found for ${year}` });
    }

    res.json({
      season: list.season,
      round: Number(list.round),
      standings: list.DriverStandings.map((s) => ({
        position: Number(s.position),
        points: Number(s.points),
        wins: Number(s.wins),
        driver: {
          id: s.Driver.driverId,
          code: s.Driver.code ?? null,
          firstName: s.Driver.givenName,
          lastName: s.Driver.familyName,
          nationality: s.Driver.nationality,
          url: s.Driver.url,
        },
        constructors: s.Constructors.map((c) => ({
          id: c.constructorId,
          name: c.name,
          nationality: c.nationality,
        })),
      })),
    });
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({
      error: `Failed to fetch ${year} driver standings`,
      details: err.message,
    });
  }
});

// ─── Constructor Standings ────────────────────────────────────────────────────

/**
 * @swagger
 * /standings/{year}/constructors:
 *   get:
 *     summary: Get constructor championship standings for a season
 *     description: >
 *       Returns the constructor standings at the end of (or latest point in)
 *       the given season.
 *     tags: [Standings]
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *         description: F1 season year (e.g. 2026)
 *     responses:
 *       200:
 *         description: Array of constructor standing entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 season:
 *                   type: string
 *                 round:
 *                   type: integer
 *                 standings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ConstructorStanding'
 *       404:
 *         description: No standings found for that year
 *       500:
 *         description: Upstream fetch failed
 */
router.get("/:year/constructors", async (req, res) => {
  const { year } = req.params;

  try {
    const data = await fetchFromErgast(`/${year}/constructorStandings.json`, {
      limit: 15,
    });
    const list = data.StandingsTable?.StandingsLists?.[0];

    if (!list) {
      return res
        .status(404)
        .json({ error: `No constructor standings found for ${year}` });
    }

    res.json({
      season: list.season,
      round: Number(list.round),
      standings: list.ConstructorStandings.map((s) => ({
        position: Number(s.position),
        points: Number(s.points),
        wins: Number(s.wins),
        constructor: {
          id: s.Constructor.constructorId,
          name: s.Constructor.name,
          nationality: s.Constructor.nationality,
          url: s.Constructor.url,
        },
      })),
    });
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({
      error: `Failed to fetch ${year} constructor standings`,
      details: err.message,
    });
  }
});

module.exports = router;
