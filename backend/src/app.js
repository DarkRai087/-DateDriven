const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const driversRouter = require("./routes/drivers");
const racesRouter = require("./routes/races");
const standingsRouter = require("./routes/standings");
const newsRouter = require("./routes/news");

const app = express();

app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "F1 API", uptime: process.uptime() });
});

// API routes
app.use("/api/drivers", driversRouter);
app.use("/api/races", racesRouter);
app.use("/api/standings", standingsRouter);
app.use("/api/news", newsRouter);

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve raw OpenAPI JSON (useful for tooling)
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error", details: err.message });
});

module.exports = app;
