# Wind Forecast Monitor – Project Plan

Web app for a UK energy supplier's day-ahead trading team. It shows the wind forecast that was available
when each buying decision had to be made, and measures how accurate those forecasts were.

---

## 0. Data findings (checked against the live Elexon API)

| | Actuals – `FUELHH` (`fuelType=WIND`) | Forecasts – `WINDFOR` |
|---|---|---|
| Endpoint | `https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream` | `https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream` |
| Filter params | `settlementDateFrom`, `settlementDateTo`, `fuelType` | `publishDateTimeFrom`, `publishDateTimeTo` |
| Fields used | `startTime`, `generation` (MW) | `startTime`, `publishTime`, `generation` (MW) |
| Resolution | 30 min | 1 hour |
| Volume (Jan) | ~1,500 rows | ~20,000 rows |

- No API key is needed. The data is small, so **no database**: fetch it and keep it in memory.
- Forecasts are published **about 8 times a day** (02:30, 04:30, 07:30, 09:30, 11:30, 15:30, 18:30 and
  22:30 UTC). Each one covers about 3 days ahead.
- Actuals are half-hourly and forecasts are hourly, so **each pair of half-hour actuals is averaged into one
  hourly value** before comparing.
- January is GMT, so **UK time = UTC**. There are no clock-change problems.
- **Scope:** decisions made on **Jan 1–31, 2026** cover delivery days **Jan 2 – Feb 1, 2026**.
  - Forecasts needed: published Dec 31, 2025 – Jan 31, 2026
  - Actuals needed: Jan 2 – Feb 1, 2026

---

## 1. Full-stack plan

### Core idea
For each **decision day D**, the app picks the **latest forecast published before the decision cutoff
on D** for every hour of delivery day **D+1**. It then compares those forecasts with what actually happened.
The cutoff is adjustable and defaults to **09:00 UK time**, which is before both GB day-ahead auction deadlines
(about 09:20 for EPEX SPOT and 09:50 for N2EX). With that default, the app uses the **07:30 forecast**.

### Architecture
```
React (Vite + TypeScript + Recharts)
        │  /api/*  (JSON)
        ▼
FastAPI (Python) ── fetch once, cache in memory ──► Elexon API (FUELHH, WINDFOR)
        │
   pandas analysis: pick decision-time forecasts → calculate errors
```

### Deployment
- **Vercel** (free): React as a static site, FastAPI as a Python serverless function under `/api`.
- **Docker** for local runs: `docker compose up` starts the backend and frontend
  (Nginx serves the app and forwards `/api`).
- **Backup data file:** a saved copy of January's data. The app uses it if Elexon is down,
  so the demo can't break.

### Repo layout
```
backend/
  app/
    main.py          FastAPI app + routes
    config.py        settings (dates, default cutoff)
    elexon.py        Elexon API client
    forecasts.py     decision-time forecast selection
    metrics.py       error metrics
    schemas.py       Pydantic response models
  data/              saved backup of January's data
  tests/
  requirements.txt
  Dockerfile
frontend/
  src/
    api/client.ts
    components/
    pages/
  Dockerfile
  nginx.conf
api/index.py         Vercel entry point (imports the FastAPI app)
vercel.json
docker-compose.yml
README.md
.github/workflows/ci.yml
```

### Build order
| # | Phase | Time | Status |
|---|---|---|---|
| 1 | Backend logic and tests (Elexon client, forecast selection, metrics) | 1.5 h | ☐ |
| 2 | API endpoints | 0.5 h | ☐ |
| 3 | Frontend (both tabs) | 2 h | ☐ |
| 4 | Docker and compose | 0.5 h | ☐ |
| 5 | Vercel deploy, README, automated tests on GitHub | 1 h | ☐ |
| 6 | Video (client pitch + tech-lead walkthrough) | 1.5 h | ☐ |

---

## 2. Backend plan (Python + FastAPI)

> Full details: [BACKEND_PLAN.md](BACKEND_PLAN.md)

### Modules
- **`elexon.py`** – fetches the data, with retries and timeouts. It splits the request range into chunks and
  keeps only `fuelType=WIND` for actuals.
- **`forecasts.py`** – **the core logic.** For each target hour it:
  1. keeps forecasts published before the cutoff,
  2. takes the latest one, and
  3. records which forecast was used and how many hours ahead it was made.
- **`metrics.py`** – works out the error (forecast − actual) and these figures:
  - **MAE** (average size of the error) and **RMSE** (an average that weighs big misses more)
  - **Bias:** positive means wind was over-forecast, so the team risks buying too little power
  - **MAE as % of average generation** (more meaningful than percentage error, which breaks down
    when wind is near zero)
  - **P10, P50 and P90 of the error:** the point that 10%, 50% or 90% of errors fall below
  - **Error by hour of day** and **error by how far ahead the forecast was made**
- **`schemas.py`** – Pydantic models that define the shape of each response.

### Endpoints
| Endpoint | Returns |
|---|---|
| `GET /api/health` | Status check |
| `GET /api/meta` | Available dates and forecast publish times |
| `GET /api/day-ahead?decision_date=2026-01-15&cutoff=09:00` | Hourly forecast vs. actual for the delivery day, plus which forecast was used and how far ahead it was made |
| `GET /api/accuracy?cutoff=09:00` | Whole-month summary figures, error by hour, error distribution and daily error |

### Code-quality practices
- Tests (pytest):
  - forecast selection: latest before cutoff, ignoring later forecasts, gaps in the data
  - metrics
  - API routes with Elexon calls faked
- Type hints throughout, `ruff` for lint checks
- A GitHub Actions workflow that runs lint and tests on every push

---

## 3. Frontend plan (React + TypeScript)

> Full details: [FRONTEND_PLAN.md](FRONTEND_PLAN.md)

### Tab 1 – Day-ahead view (what the team sees when deciding)
- **Controls:** decision date (Jan 1–31) and cutoff time
- **Summary cards:** total forecast energy for the delivery day (MWh), peak and lowest forecast,
  which forecast was used and when it was published
- **Main chart:** hourly forecast line with a **shaded uncertainty band** based on January's P10–P90
  errors for each hour. Actual generation is overlaid to show how the forecast turned out.

### Tab 2 – Forecast accuracy (the measured error)
- **Summary cards:** MAE, RMSE, bias, P90 error
- **Charts:** error by hour of day, error distribution histogram, daily error over January
- **Plain-language recommendation for the client**, e.g. *"To be covered in 90% of hours, plan for
  about X MW less wind than forecast."* This is the main pitch moment.

### Components
`api/client.ts`, `DecisionControls`, `KpiCard`, `ForecastChart`, `ErrorByHourChart`,
`ErrorHistogram`, `DailyErrorChart`, plus loading and error states.

---

## 4. Defaults chosen
- TypeScript, Vite, Recharts
- FastAPI + pandas
- Vercel for hosting (Heroku has no free tier)
- Adjustable decision cutoff, default 09:00 UK time (before both GB day-ahead auction deadlines)

---

## 5. Submission checklist
- [ ] **Video** (unlisted YouTube, 10 min max)
  - [ ] Part 1: client pitch (5 min max)
  - [ ] Part 2: tech-lead walkthrough of architecture, design, analysis, code and practices (5 min max)
- [ ] **Public GitHub repo** with an anonymous random name (e.g. `kjhwr`)
- [ ] **README** covering:
  - [ ] what each file and directory contains
  - [ ] how to start the app
  - [ ] link to the Vercel app
  - [ ] a note that AI tools were used
- [ ] **Submission form:** https://forms.cloud.microsoft/r/Ljmf1aWESK
- [ ] Open every submitted link in an incognito window to check it's publicly accessible
- [ ] Total time spent: 16 hours or less
