# DateDriven — F1 Backend API

**DateDriven** is a Formula 1 data platform built to unify live, historical, and contextual F1 data behind a single API. This backend is the data layer for the [DD-frontend](../DD-frontend) dashboard and the foundation for future **AI/ML** features — race prediction, strategy modeling, and data-driven insights.

Today it aggregates and normalizes data from multiple public F1 sources. Tomorrow it becomes the pipeline that feeds models trained on decades of race history and live telemetry.

---

## What This Project Is

A Node.js / Express REST API that:

- **Unifies fragmented F1 data** from OpenF1, Jolpica (Ergast + Alpha), and NewsAPI into consistent JSON responses
- **Normalizes schemas** so the frontend (and future ML services) consume one shape for drivers, races, sessions, and standings
- **Caches aggressively** with smart TTLs so repeated requests don't hammer upstream APIs
- **Documents every endpoint** via Swagger at `/api-docs`

### Data Sources

| Source | What it provides |
|--------|------------------|
| [OpenF1](https://openf1.org) | Live/current grid — drivers, teams, session metadata |
| [Jolpica Ergast](https://api.jolpi.ca/ergast/f1) | Historical schedules, results, qualifying, standings |
| [Jolpica Alpha](https://api.jolpi.ca/f1/alpha) | Full weekend sessions — FP1, FP2, FP3, SQ, SR, Q, R |
| NewsAPI | F1 news articles with daily caching |

### Architecture

```
┌─────────────┐     ┌──────────────────────────────────────┐     ┌──────────────┐
│ DD-frontend │────▶│  DateDriven Backend (this repo)      │────▶│  OpenF1      │
│  (Next.js)  │     │  Express · Cache · Swagger           │     │  Jolpica     │
└─────────────┘     │                                      │     │  NewsAPI     │
                    │  /api/drivers  /api/races            │     └──────────────┘
                    │  /api/standings  /api/news           │
                    └──────────────────────────────────────┘
                                      │
                                      ▼  (planned)
                    ┌──────────────────────────────────────┐
                    │  ML Service — predictions, features  │
                    │  Python · scikit-learn / PyTorch     │
                    └──────────────────────────────────────┘
```

---

## API Overview

Base URL: `http://localhost:5000/api`

| Route | Description |
|-------|-------------|
| `GET /health` | Service health check |
| `GET /drivers` | Current grid from OpenF1 |
| `GET /drivers/:driver_number` | Single driver by car number |
| `GET /races/:year` | Season calendar |
| `GET /races/:year/full` | Calendar + podium results (optimized) |
| `GET /races/:year/winners` | Winner per completed round |
| `GET /races/:year/:round/results` | Race results |
| `GET /races/:year/:round/qualifying` | Qualifying results |
| `GET /races/:year/:round/details` | Full weekend — all sessions + circuit info |
| `GET /standings/:year/drivers` | Driver championship standings |
| `GET /standings/:year/constructors` | Constructor standings |
| `GET /news` | F1 news (paginated, cached) |
| `GET /api-docs` | Interactive Swagger UI |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Server runs at **http://localhost:5000**. Swagger docs at **http://localhost:5000/api-docs**.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `OPENF1_BASE_URL` | `https://api.openf1.org/v1` | OpenF1 API base |
| `ERGAST_BASE_URL` | `https://api.jolpi.ca/ergast/f1` | Jolpica Ergast base |
| `NEWS_API_KEY` | — | NewsAPI key (required for `/news`) |

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with hot reload (`node --watch`) |
| `npm start` | Production start |

---

## Project Structure

```
backend/
├── server.js              # Entry point
├── src/
│   ├── app.js             # Express app, CORS, route mounting
│   ├── config/
│   │   └── swagger.js     # OpenAPI spec
│   ├── routes/
│   │   ├── drivers.js
│   │   ├── races.js
│   │   ├── standings.js
│   │   └── news.js
│   └── services/
│       ├── cache.js       # In-memory cache with TTL
│       ├── ergast.js      # Jolpica Ergast client
│       ├── jolpica.js     # Jolpica Alpha (session results)
│       ├── openf1.js      # OpenF1 client
│       └── newsapi.js     # NewsAPI client
└── .env.example
```

---

## Where We're Going — AI/ML Roadmap

DateDriven is intentionally **data-first**. The backend already exposes structured, cacheable datasets that map directly to ML feature engineering. The goal is to move from *displaying* F1 data to *learning from* it.

### Phase 1 — Data Foundation (current)

- [x] Unified REST API across live + historical sources
- [x] In-memory caching with TTL by data type (5 min → 24 h)
- [x] Normalized race, session, driver, and standings schemas
- [x] Combined endpoints to reduce latency for the frontend
- [ ] Persistent storage (PostgreSQL / TimescaleDB) for training datasets
- [ ] Scheduled ETL jobs to snapshot race weekends into a feature store

### Phase 2 — Feature Engineering

Build tabular features from data we already fetch:

| Feature domain | Source data | Example features |
|----------------|-------------|------------------|
| Race outcomes | Ergast results | grid position, position delta, fastest lap, DNF rate |
| Qualifying | Qualifying + FP sessions | Q1/Q2/Q3 gaps, practice pace vs quali pace |
| Circuit context | Schedule + circuit metadata | track type, avg laps, sprint vs conventional |
| Championship | Standings | points gap, win rate, podium rate, constructor strength |
| News sentiment | NewsAPI articles | headline sentiment, topic clustering per driver/team |

Planned deliverable: a `/api/features/:year/:round` endpoint that returns model-ready vectors for each driver.

### Phase 3 — Predictive Models

| Model | Input | Output | Use case |
|-------|-------|--------|----------|
| **Race finish predictor** | Grid, quali times, historical circuit performance, weather | P1–P20 probability distribution | Pre-race dashboard insights |
| **Qualifying forecaster** | FP1/FP2/FP3 sector times | Predicted quali order | Strategy preview |
| **DNF / reliability classifier** | Team history, car age, session incidents | DNF probability | Risk indicators |
| **Championship simulator** | Current standings + remaining calendar | Title probability (Monte Carlo) | Season projections |

Tech stack (planned): **Python** microservice (FastAPI) called from this backend, models trained with **scikit-learn** / **XGBoost** for tabular data, with optional **PyTorch** for sequence models on lap-by-lap telemetry.

### Phase 4 — Live Intelligence

Once OpenF1 telemetry endpoints are integrated (lap times, tire compounds, pit stops, weather):

- **Real-time strategy advisor** — undercut/overcut probability given current stint lengths
- **Anomaly detection** — flag unusual sector times or car behavior during a session
- **LLM-powered race briefings** — summarize news + historical context + model predictions into natural-language pre-race reports

### Phase 5 — Product Integration

Surface ML outputs in the DD-frontend dashboard:

- Prediction cards on race detail pages
- Confidence intervals, not just point estimates
- Model performance tracking (calibration, Brier score) exposed via `/api/models/metrics`

---

## Why "DateDriven"?

F1 is one of the most data-rich sports in the world — every lap, pit stop, and sector time is recorded. **DateDriven** means building decisions on that data instead of gut feeling: for fans who want deeper insight, and eventually for models that can predict what happens next.

The backend you see today is step one: a reliable, fast, documented data pipeline. The AI/ML layer is step two: turn that pipeline into intelligence.

---

## Related Projects

| Repo | Role |
|------|------|
| [DD-frontend](../DD-frontend) | Next.js dashboard — race calendar, standings, drivers, news |
| `DateDriven/backend` (this repo) | Data aggregation API + future ML gateway |

---

## License

ISC
