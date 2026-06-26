const axios = require("axios");
const { cacheThrough } = require("./cache");

const ALPHA_BASE = "https://api.jolpi.ca/f1/alpha";

const alphaClient = axios.create({
  baseURL: ALPHA_BASE,
  timeout: 15000,
  headers: { Accept: "application/json" },
});

const SESSION_ORDER = ["FP1", "FP2", "FP3", "SQ", "SR", "Q", "R"];

/**
 * Fetch the full season schedule from the Jolpica alpha API (cached).
 */
async function fetchSchedule(year) {
  const currentYear = new Date().getFullYear();
  const ttl = year < currentYear ? 86400 : 3600; // 24h for past, 1h for current
  
  return cacheThrough(
    `jolpica:schedule:${year}`,
    async () => {
      const response = await alphaClient.get(`/schedules/${year}/`);
      return response.data.data;
    },
    ttl
  );
}

/**
 * Find a round event by round number within a season schedule.
 */
function findRoundEvent(scheduleData, roundNumber) {
  return scheduleData.events?.find((e) => e.round?.number === roundNumber) ?? null;
}

/**
 * Map an alpha API result row to our normalized format.
 */
function mapAlphaResult(r) {
  return {
    position: r.position,
    positionText: r.position_text,
    number: r.car_number,
    driver: {
      code: r.driver.abbreviation ?? null,
      firstName: r.driver.given_name,
      lastName: r.driver.family_name,
    },
    constructor: {
      name: r.team.name,
      color: r.team.primary_color ?? null,
    },
    time: r.time ?? null,
    laps: r.laps ?? null,
    status: r.status ?? null,
    isClassified: r.is_classified ?? true,
    points: r.points ?? null,
    grid: r.grid ?? null,
    components: r.components ?? {},
  };
}

/**
 * Fetch results for a single session (FP1, FP2, FP3, SQ, SR, Q, R) with caching.
 */
async function fetchSessionResults(roundId, sessionCode) {
  try {
    return await cacheThrough(
      `jolpica:results:${roundId}:${sessionCode}`,
      async () => {
        const response = await alphaClient.get(`/results/${roundId}/${sessionCode}/`);
        const data = response.data.data;
        return {
          code: data.code,
          title: data.title,
          results: (data.results ?? []).map(mapAlphaResult),
        };
      },
      300 // 5 minutes for session results
    );
  } catch {
    return null;
  }
}

/**
 * Get weekend info and all available session results for a round.
 */
async function getWeekendSessions(year, roundNumber) {
  let scheduleData;
  try {
    scheduleData = await fetchSchedule(year);
  } catch {
    return null;
  }

  const event = findRoundEvent(scheduleData, roundNumber);
  if (!event) return null;

  const roundId = event.round.id;
  const scheduleCodes = event.schedule.map((s) => s.code);
  const isSprintWeekend =
    scheduleCodes.includes("SQ") || scheduleCodes.includes("SR");

  let availableTypes = [];
  try {
    const availRes = await alphaClient.get(`/results/${roundId}/`);
    availableTypes = (availRes.data.data.available_results ?? []).map(
      (r) => r.type
    );
  } catch {
    availableTypes = scheduleCodes.filter((c) =>
      ["FP1", "FP2", "FP3", "SQ", "SR", "Q", "R"].includes(c)
    );
  }

  const orderedSessions = SESSION_ORDER.filter(
    (s) => availableTypes.includes(s) || scheduleCodes.includes(s)
  );

  const sessionFetches = orderedSessions.map(async (code) => {
    const data = await fetchSessionResults(roundId, code);
    return [code, data];
  });

  const sessionEntries = await Promise.all(sessionFetches);
  const sessions = {};
  for (const [code, data] of sessionEntries) {
    if (data?.results?.length) {
      sessions[code] = data;
    }
  }

  return {
    roundId,
    isSprintWeekend,
    scheduleCodes,
    availableSessions: orderedSessions.filter((s) => sessions[s]),
    sessions,
    eventMeta: {
      raceName: event.round.name,
      date:
        event.schedule.find((s) => s.code === "R")?.timestamp?.split("T")[0] ??
        "",
      circuit: {
        id: event.circuit.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        name: event.circuit.name,
        locality: event.circuit.locality,
        country: event.circuit.country,
        lat: String(event.circuit.latitude ?? ""),
        long: String(event.circuit.longitude ?? ""),
      },
    },
  };
}

module.exports = {
  fetchSchedule,
  findRoundEvent,
  getWeekendSessions,
  fetchSessionResults,
};
