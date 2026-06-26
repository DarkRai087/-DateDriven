const express = require("express");
const { fetchFromErgast } = require("../services/ergast");
const { getWeekendSessions } = require("../services/jolpica");
const { cache } = require("../services/cache");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Races
 *   description: Race schedules and results via Jolpica/Ergast
 */

// ─── Schedule ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /races/{year}:
 *   get:
 *     summary: Get race schedule for a season
 *     description: >
 *       Returns the full race calendar for the given year.
 *       The frontend calls this when the user toggles the year selector.
 *     tags: [Races]
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *         description: F1 season year (e.g. 2026)
 *     responses:
 *       200:
 *         description: Array of race schedule entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 season:
 *                   type: string
 *                 total:
 *                   type: integer
 *                 races:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RaceSchedule'
 *       404:
 *         description: No races found for that year
 *       500:
 *         description: Upstream fetch failed
 */
router.get("/:year", async (req, res) => {
  const { year } = req.params;

  try {
    const data = await fetchFromErgast(`/${year}.json`, { limit: 30 });
    const races = data.RaceTable?.Races ?? [];

    if (races.length === 0) {
      return res.status(404).json({ error: `No races found for season ${year}` });
    }

    res.json({
      season: year,
      total: races.length,
      races: races.map((r) => ({
        round: Number(r.round),
        raceName: r.raceName,
        date: r.date,
        time: r.time ?? null,
        circuit: {
          id: r.Circuit.circuitId,
          name: r.Circuit.circuitName,
          locality: r.Circuit.Location.locality,
          country: r.Circuit.Location.country,
          lat: r.Circuit.Location.lat,
          long: r.Circuit.Location.long,
          url: r.Circuit.url,
        },
        url: r.url,
      })),
    });
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({
      error: `Failed to fetch ${year} schedule`,
      details: err.message,
    });
  }
});

// ─── Race Results ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /races/{year}/{round}/results:
 *   get:
 *     summary: Get race results for a specific round
 *     description: >
 *       Returns the top finishing positions (default top 10) for a single race.
 *       The frontend calls this when the user clicks on a race row.
 *     tags: [Races]
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *         description: F1 season year (e.g. 2026)
 *       - in: path
 *         name: round
 *         required: true
 *         schema:
 *           type: integer
 *         description: Race round number (e.g. 1 for the first race)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: How many finishing positions to return
 *     responses:
 *       200:
 *         description: Race result object with winner and top finishers
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RaceResult'
 *       404:
 *         description: No results found for that round
 *       500:
 *         description: Upstream fetch failed
 */
router.get("/:year/:round/results", async (req, res) => {
  const { year, round } = req.params;
  const limit = Math.min(Number(req.query.limit) || 10, 30);

  try {
    const data = await fetchFromErgast(`/${year}/${round}/results.json`, {
      limit,
    });
    const race = data.RaceTable?.Races?.[0];

    if (!race) {
      return res
        .status(404)
        .json({ error: `No results found for ${year} round ${round}` });
    }

    const results = (race.Results ?? []).map((r) => ({
      position: Number(r.position),
      number: Number(r.number),
      driver: {
        id: r.Driver.driverId,
        code: r.Driver.code ?? null,
        firstName: r.Driver.givenName,
        lastName: r.Driver.familyName,
        nationality: r.Driver.nationality,
        url: r.Driver.url,
      },
      constructor: {
        id: r.Constructor.constructorId,
        name: r.Constructor.name,
        nationality: r.Constructor.nationality,
      },
      grid: Number(r.grid),
      laps: Number(r.laps),
      status: r.status,
      time: r.Time?.time ?? null,
      points: Number(r.points),
      fastestLap: r.FastestLap
        ? {
            rank: Number(r.FastestLap.rank),
            lap: Number(r.FastestLap.lap),
            time: r.FastestLap.Time?.time ?? null,
            speed: r.FastestLap.AverageSpeed
              ? {
                  value: r.FastestLap.AverageSpeed.speed,
                  units: r.FastestLap.AverageSpeed.units,
                }
              : null,
          }
        : null,
    }));

    res.json({
      season: race.season,
      round: Number(race.round),
      raceName: race.raceName,
      date: race.date,
      time: race.time ?? null,
      circuit: {
        id: race.Circuit.circuitId,
        name: race.Circuit.circuitName,
        locality: race.Circuit.Location.locality,
        country: race.Circuit.Location.country,
      },
      winner: results[0] ?? null,
      results,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({
      error: `Failed to fetch results for ${year} round ${round}`,
      details: err.message,
    });
  }
});

// ─── Season Winners ───────────────────────────────────────────────────────────

/**
 * @swagger
 * /races/{year}/winners:
 *   get:
 *     summary: Get the winner of every completed race in a season
 *     description: >
 *       Returns one entry per completed race containing only the winner.
 *       Future/cancelled races are omitted. Used by the frontend to enrich
 *       the race schedule cards without making one request per round.
 *     tags: [Races]
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *         description: F1 season year (e.g. 2026)
 *     responses:
 *       200:
 *         description: Map of round → winner keyed by round number
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 season:
 *                   type: string
 *                 winners:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *       500:
 *         description: Upstream fetch failed
 */
router.get("/:year/winners", async (req, res) => {
  const { year } = req.params;

  try {
    const [p1, p2, p3] = await Promise.all([
      fetchFromErgast(`/${year}/results/1.json`, { limit: 30 }),
      fetchFromErgast(`/${year}/results/2.json`, { limit: 30 }),
      fetchFromErgast(`/${year}/results/3.json`, { limit: 30 }),
    ]);

    function byRound(data) {
      const map = {};
      for (const race of data.RaceTable?.Races ?? []) {
        map[Number(race.round)] = race.Results?.[0];
      }
      return map;
    }

    function mapResult(result, position) {
      return {
        position,
        driver: {
          id: result.Driver.driverId,
          code: result.Driver.code ?? null,
          firstName: result.Driver.givenName,
          lastName: result.Driver.familyName,
          nationality: result.Driver.nationality,
        },
        constructor: {
          id: result.Constructor.constructorId,
          name: result.Constructor.name,
        },
        time: result.Time?.time ?? null,
      };
    }

    const first = byRound(p1);
    const second = byRound(p2);
    const third = byRound(p3);

    const podiums = {};
    const winners = {};

    for (const race of p1.RaceTable?.Races ?? []) {
      const round = Number(race.round);
      const podium = [];
      if (first[round]) podium.push(mapResult(first[round], 1));
      if (second[round]) podium.push(mapResult(second[round], 2));
      if (third[round]) podium.push(mapResult(third[round], 3));
      if (podium.length === 0) continue;

      podiums[round] = podium;
      winners[round] = {
        round,
        raceName: race.raceName,
        date: race.date,
        ...podium[0],
        laps: Number(first[round]?.laps ?? 0),
      };
    }

    res.json({ season: year, winners, podiums });
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({
      error: `Failed to fetch ${year} winners`,
      details: err.message,
    });
  }
});

// ─── Qualifying Results ──────────────────────────────────────────────────────

/**
 * @swagger
 * /races/{year}/{round}/qualifying:
 *   get:
 *     summary: Get qualifying results for a specific round
 *     tags: [Races]
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: round
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Qualifying results
 *       404:
 *         description: No qualifying found
 */
router.get("/:year/:round/qualifying", async (req, res) => {
  const { year, round } = req.params;

  try {
    const data = await fetchFromErgast(`/${year}/${round}/qualifying.json`, {
      limit: 25,
    });
    const race = data.RaceTable?.Races?.[0];

    if (!race) {
      return res
        .status(404)
        .json({ error: `No qualifying found for ${year} round ${round}` });
    }

    const results = (race.QualifyingResults ?? []).map((r) => ({
      position: Number(r.position),
      number: Number(r.number),
      driver: {
        id: r.Driver.driverId,
        code: r.Driver.code ?? null,
        firstName: r.Driver.givenName,
        lastName: r.Driver.familyName,
        nationality: r.Driver.nationality,
      },
      constructor: {
        id: r.Constructor.constructorId,
        name: r.Constructor.name,
        nationality: r.Constructor.nationality,
      },
      q1: r.Q1 ?? null,
      q2: r.Q2 ?? null,
      q3: r.Q3 ?? null,
    }));

    res.json({
      season: race.season,
      round: Number(race.round),
      raceName: race.raceName,
      date: race.date,
      circuit: {
        id: race.Circuit.circuitId,
        name: race.Circuit.circuitName,
        locality: race.Circuit.Location.locality,
        country: race.Circuit.Location.country,
      },
      results,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({
      error: `Failed to fetch qualifying for ${year} round ${round}`,
      details: err.message,
    });
  }
});

// ─── Full Race Details ───────────────────────────────────────────────────────

/**
 * @swagger
 * /races/{year}/{round}/details:
 *   get:
 *     summary: Get comprehensive race details including circuit info
 *     tags: [Races]
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: round
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Full race details with results and circuit info
 *       404:
 *         description: Race not found
 */
router.get("/:year/:round/details", async (req, res) => {
  const { year, round } = req.params;

  try {
    const [raceData, qualifyingData, sprintData, weekendData, scheduleData] =
      await Promise.all([
      fetchFromErgast(`/${year}/${round}/results.json`, { limit: 25 }).catch(
        () => null
      ),
      fetchFromErgast(`/${year}/${round}/qualifying.json`, { limit: 25 }).catch(
        () => null
      ),
      fetchFromErgast(`/${year}/${round}/sprint.json`, { limit: 25 }).catch(
        () => null
      ),
      getWeekendSessions(Number(year), Number(round)).catch(() => null),
      fetchFromErgast(`/${year}.json`, { limit: 30 }).catch(() => null),
    ]);

    const race = raceData?.RaceTable?.Races?.[0];
    const quali = qualifyingData?.RaceTable?.Races?.[0];
    const sprint = sprintData?.RaceTable?.Races?.[0];
    const scheduledRace = scheduleData?.RaceTable?.Races?.find(
      (r) => Number(r.round) === Number(round)
    );

    if (!race && !weekendData && !scheduledRace) {
      return res
        .status(404)
        .json({ error: `No race found for ${year} round ${round}` });
    }

    const raceResults = race
      ? (race.Results ?? []).map((r) => ({
          position: Number(r.position),
          positionText: r.positionText,
          number: Number(r.number),
          driver: {
            id: r.Driver.driverId,
            code: r.Driver.code ?? null,
            firstName: r.Driver.givenName,
            lastName: r.Driver.familyName,
            nationality: r.Driver.nationality,
            dateOfBirth: r.Driver.dateOfBirth,
          },
          constructor: {
            id: r.Constructor.constructorId,
            name: r.Constructor.name,
            nationality: r.Constructor.nationality,
          },
          grid: Number(r.grid),
          laps: Number(r.laps),
          status: r.status,
          time: r.Time?.time ?? null,
          millis: r.Time?.millis ? Number(r.Time.millis) : null,
          points: Number(r.points),
          fastestLap: r.FastestLap
            ? {
                rank: Number(r.FastestLap.rank),
                lap: Number(r.FastestLap.lap),
                time: r.FastestLap.Time?.time ?? null,
                speed: r.FastestLap.AverageSpeed
                  ? {
                      value: r.FastestLap.AverageSpeed.speed,
                      units: r.FastestLap.AverageSpeed.units,
                    }
                  : null,
              }
            : null,
        }))
      : [];

    const qualifyingResults = quali
      ? (quali.QualifyingResults ?? []).map((r) => ({
          position: Number(r.position),
          number: Number(r.number),
          driver: {
            id: r.Driver.driverId,
            code: r.Driver.code ?? null,
            firstName: r.Driver.givenName,
            lastName: r.Driver.familyName,
          },
          constructor: {
            id: r.Constructor.constructorId,
            name: r.Constructor.name,
          },
          q1: r.Q1 ?? null,
          q2: r.Q2 ?? null,
          q3: r.Q3 ?? null,
        }))
      : [];

    const sprintResults = sprint
      ? (sprint.SprintResults ?? []).map((r) => ({
          position: Number(r.position),
          positionText: r.positionText,
          number: Number(r.number),
          driver: {
            id: r.Driver.driverId,
            code: r.Driver.code ?? null,
            firstName: r.Driver.givenName,
            lastName: r.Driver.familyName,
            nationality: r.Driver.nationality,
          },
          constructor: {
            id: r.Constructor.constructorId,
            name: r.Constructor.name,
            nationality: r.Constructor.nationality,
          },
          grid: Number(r.grid),
          laps: Number(r.laps),
          status: r.status,
          time: r.Time?.time ?? null,
          points: Number(r.points),
        }))
      : [];

    const totalLaps = raceResults[0]?.laps ?? 0;

    const meta = weekendData?.eventMeta;

    const circuit = race
      ? {
          id: race.Circuit.circuitId,
          name: race.Circuit.circuitName,
          locality: race.Circuit.Location.locality,
          country: race.Circuit.Location.country,
          lat: race.Circuit.Location.lat,
          long: race.Circuit.Location.long,
          url: race.Circuit.url,
        }
      : scheduledRace
        ? {
            id: scheduledRace.Circuit.circuitId,
            name: scheduledRace.Circuit.circuitName,
            locality: scheduledRace.Circuit.Location.locality,
            country: scheduledRace.Circuit.Location.country,
            lat: scheduledRace.Circuit.Location.lat,
            long: scheduledRace.Circuit.Location.long,
            url: scheduledRace.Circuit.url,
          }
        : meta?.circuit ?? {
            id: "",
            name: "",
            locality: "",
            country: "",
          };

    res.json({
      season: race?.season ?? scheduledRace?.season ?? year,
      round: Number(race?.round ?? scheduledRace?.round ?? round),
      raceName: race?.raceName ?? scheduledRace?.raceName ?? meta?.raceName ?? "",
      date: race?.date ?? scheduledRace?.date ?? meta?.date ?? "",
      time: race?.time ?? scheduledRace?.time ?? null,
      url: race?.url ?? scheduledRace?.url ?? "",
      circuit,
      totalLaps,
      isSprintWeekend: weekendData?.isSprintWeekend ?? sprintResults.length > 0,
      availableSessions:
        weekendData?.availableSessions?.length > 0
          ? weekendData.availableSessions
          : weekendData?.scheduleCodes?.filter((c) =>
              ["FP1", "FP2", "FP3", "SQ", "SR", "Q", "R"].includes(c)
            ) ?? [
              ...(qualifyingResults.length ? ["Q"] : []),
              ...(raceResults.length ? ["R"] : []),
              ...(sprintResults.length ? ["SR"] : []),
            ],
      raceResults,
      qualifyingResults,
      sprintResults,
      sessions: weekendData?.sessions ?? {},
    });
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({
      error: `Failed to fetch details for ${year} round ${round}`,
      details: err.message,
    });
  }
});

// ─── Combined Schedule + Winners (Performance Optimization) ──────────────────

/**
 * @swagger
 * /races/{year}/full:
 *   get:
 *     summary: Get race schedule with podium results in a single request
 *     description: >
 *       Combines schedule and winners endpoints to reduce round-trips.
 *       Returns the full race calendar with podium finishers for completed races.
 *     tags: [Races]
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Schedule with embedded podium data
 */
router.get("/:year/full", async (req, res) => {
  const { year } = req.params;

  try {
    // Fetch schedule and all position results in parallel
    const [scheduleData, p1, p2, p3] = await Promise.all([
      fetchFromErgast(`/${year}.json`, { limit: 30 }),
      fetchFromErgast(`/${year}/results/1.json`, { limit: 30 }),
      fetchFromErgast(`/${year}/results/2.json`, { limit: 30 }),
      fetchFromErgast(`/${year}/results/3.json`, { limit: 30 }),
    ]);

    const races = scheduleData.RaceTable?.Races ?? [];

    if (races.length === 0) {
      return res.status(404).json({ error: `No races found for season ${year}` });
    }

    // Build podium maps
    function byRound(data) {
      const map = {};
      for (const race of data.RaceTable?.Races ?? []) {
        map[Number(race.round)] = race.Results?.[0];
      }
      return map;
    }

    function mapResult(result, position) {
      if (!result) return null;
      return {
        position,
        driver: {
          id: result.Driver.driverId,
          code: result.Driver.code ?? null,
          firstName: result.Driver.givenName,
          lastName: result.Driver.familyName,
          nationality: result.Driver.nationality,
        },
        constructor: {
          id: result.Constructor.constructorId,
          name: result.Constructor.name,
        },
        time: result.Time?.time ?? null,
      };
    }

    const first = byRound(p1);
    const second = byRound(p2);
    const third = byRound(p3);

    const podiums = {};
    const winners = {};

    for (const race of p1.RaceTable?.Races ?? []) {
      const round = Number(race.round);
      const podium = [];
      if (first[round]) podium.push(mapResult(first[round], 1));
      if (second[round]) podium.push(mapResult(second[round], 2));
      if (third[round]) podium.push(mapResult(third[round], 3));
      if (podium.length === 0) continue;

      podiums[round] = podium;
      winners[round] = {
        round,
        raceName: race.raceName,
        date: race.date,
        ...podium[0],
        laps: Number(first[round]?.laps ?? 0),
      };
    }

    res.json({
      season: year,
      total: races.length,
      races: races.map((r) => ({
        round: Number(r.round),
        raceName: r.raceName,
        date: r.date,
        time: r.time ?? null,
        circuit: {
          id: r.Circuit.circuitId,
          name: r.Circuit.circuitName,
          locality: r.Circuit.Location.locality,
          country: r.Circuit.Location.country,
          lat: r.Circuit.Location.lat,
          long: r.Circuit.Location.long,
          url: r.Circuit.url,
        },
        url: r.url,
      })),
      winners,
      podiums,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({
      error: `Failed to fetch ${year} data`,
      details: err.message,
    });
  }
});

// ─── Cache Stats (Debug Endpoint) ────────────────────────────────────────────

router.get("/cache/stats", (req, res) => {
  res.json(cache.stats());
});

router.post("/cache/clear", (req, res) => {
  cache.clear();
  res.json({ message: "Cache cleared" });
});

module.exports = router;
