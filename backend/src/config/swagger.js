const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "F1 API",
      version: "1.0.0",
      description:
        "A Node.js/Express backend that aggregates Formula 1 data from the OpenF1 API (https://openf1.org). No API key required.",
      contact: {
        name: "OpenF1",
        url: "https://openf1.org",
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}/api`,
        description: "Local development server",
      },
    ],
    components: {
      schemas: {
        Driver: {
          type: "object",
          properties: {
            broadcast_name: { type: "string", example: "L. HAMILTON" },
            country_code: { type: "string", example: "GBR" },
            driver_number: { type: "integer", example: 44 },
            first_name: { type: "string", example: "Lewis" },
            full_name: { type: "string", example: "Lewis HAMILTON" },
            headshot_url: {
              type: "string",
              example:
                "https://www.formula1.com/content/dam/fom-website/drivers/L/LEWHAM01_Lewis_Hamilton/lewham01.png",
            },
            last_name: { type: "string", example: "Hamilton" },
            meeting_key: { type: "integer", example: 1229 },
            name_acronym: { type: "string", example: "HAM" },
            session_key: { type: "integer", example: 9839 },
            team_colour: { type: "string", example: "27F4D2" },
            team_name: { type: "string", example: "Mercedes" },
          },
        },
        RaceSchedule: {
          type: "object",
          properties: {
            round: { type: "integer", example: 1 },
            raceName: { type: "string", example: "Australian Grand Prix" },
            date: { type: "string", example: "2026-03-08" },
            time: { type: "string", example: "05:00:00Z", nullable: true },
            circuit: {
              type: "object",
              properties: {
                id: { type: "string", example: "albert_park" },
                name: { type: "string", example: "Albert Park Grand Prix Circuit" },
                locality: { type: "string", example: "Melbourne" },
                country: { type: "string", example: "Australia" },
                lat: { type: "string", example: "-37.8497" },
                long: { type: "string", example: "144.968" },
                url: { type: "string" },
              },
            },
            url: { type: "string" },
          },
        },
        RaceResult: {
          type: "object",
          properties: {
            season: { type: "string", example: "2026" },
            round: { type: "integer", example: 1 },
            raceName: { type: "string", example: "Australian Grand Prix" },
            date: { type: "string", example: "2026-03-08" },
            winner: { type: "object", description: "First place finisher" },
            results: { type: "array", items: { type: "object" } },
          },
        },
        DriverStanding: {
          type: "object",
          properties: {
            position: { type: "integer", example: 1 },
            points: { type: "number", example: 250 },
            wins: { type: "integer", example: 5 },
            driver: {
              type: "object",
              properties: {
                id: { type: "string", example: "russell" },
                code: { type: "string", example: "RUS" },
                firstName: { type: "string", example: "George" },
                lastName: { type: "string", example: "Russell" },
                nationality: { type: "string", example: "British" },
              },
            },
            constructors: { type: "array", items: { type: "object" } },
          },
        },
        ConstructorStanding: {
          type: "object",
          properties: {
            position: { type: "integer", example: 1 },
            points: { type: "number", example: 420 },
            wins: { type: "integer", example: 8 },
            constructor: {
              type: "object",
              properties: {
                id: { type: "string", example: "mercedes" },
                name: { type: "string", example: "Mercedes" },
                nationality: { type: "string", example: "German" },
              },
            },
          },
        },
        NewsArticle: {
          type: "object",
          properties: {
            title: { type: "string", example: "Hamilton wins Monaco Grand Prix" },
            description: { type: "string", example: "Lewis Hamilton secured his first win of the season..." },
            content: { type: "string" },
            url: { type: "string", example: "https://example.com/article" },
            urlToImage: { type: "string", example: "https://example.com/image.jpg" },
            publishedAt: { type: "string", example: "2026-06-25T10:00:00Z" },
            source: {
              type: "object",
              properties: {
                id: { type: "string", example: "bbc-sport" },
                name: { type: "string", example: "BBC Sport" },
              },
            },
            author: { type: "string", example: "John Doe" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            details: { type: "string" },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
