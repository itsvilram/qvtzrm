# Backend Plan – Python + FastAPI

Detailed plan for the backend of the Wind Forecast Monitor. See [PLAN.md](PLAN.md) for the full-stack overview.

**What the backend does:** loads January 2026 wind actuals and forecasts from Elexon. For each decision day it
picks the forecast that was available at the decision cutoff, compares it with actual generation, and serves the
results and error figures as JSON to the React frontend.

---

## 1. Tech stack

| Purpose | Choice | Why |
|---|---|---|
| Language | Python 3.12 | Required by the brief |
| Web framework | FastAPI + Uvicorn | Fast, typed, auto-generated Swagger docs at `/docs` |
| HTTP client | httpx | Timeouts and retries, and easy to fake in tests (`httpx.MockTransport`) |
| Analysis | pandas | Clear, vectorised group-by and percentile code |
| Validation | Pydantic (comes with FastAPI) | Typed request params and response models |
| Timezones | `zoneinfo` + `tzdata` | Uses `Europe/London` correctly (`tzdata` is needed on Windows and slim images) |
| Testing | pytest + FastAPI `TestClient` | Standard; no extra mocking libraries needed |
| Lint/format | ruff | One fast tool for both |

**`requirements.txt`:** `fastapi`, `uvicorn[standard]`, `httpx`, `pandas`, `tzdata`
**`requirements-dev.txt`:** `-r requirements.txt`, `pytest`, `ruff`

---

## 2. Folder structure

```
backend/
  app/
    __init__.py
    main.py          FastAPI app, CORS, router mounted at /api
    config.py        constants and env settings (dates, default cutoff, URLs, timeouts)
    elexon.py        Elexon API client: fetch + parse FUELHH (WIND) and WINDFOR
    store.py         DataStore: loads data once (live → snapshot fallback), keeps it in memory
    actuals.py       half-hourly actuals → hourly averages
    forecasts.py     decision-time forecast selection (core logic)
    metrics.py       error metrics and breakdowns
    schemas.py       Pydantic response models
    routes.py        API endpoints
    snapshot.py      CLI: `python -m app.snapshot` refreshes the saved backup data
  data/
    fuelhh_wind.json.gz   saved backup of actuals
    windfor.json.gz       saved backup of forecasts
  tests/
    conftest.py      shared fixtures (small fake datasets, fake store)
    test_elexon.py
    test_actuals.py
    test_forecasts.py
    test_metrics.py
    test_api.py
  requirements.txt
  requirements-dev.txt
  pyproject.toml     ruff + pytest config
  Dockerfile
```

---

## 3. Data sources (checked against the live API)

| | Actuals – FUELHH | Forecasts – WINDFOR |
|---|---|---|
| URL | `https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream` | `https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream` |
| Query | `settlementDateFrom=2026-01-02&settlementDateTo=2026-02-01&fuelType=WIND` | `publishDateTimeFrom=2025-12-31T00:00:00Z&publishDateTimeTo=2026-02-01T00:00:00Z` |
| Fields kept | `startTime`, `generation` | `publishTime`, `startTime`, `generation` |
| Resolution | 30 min | 1 hour (always on the hour) |
| Rows | 1,488 (no gaps, no duplicates) | 18,688 (256 forecasts, 73 hours each) |
| Response | ~270 KB, ~2 s | ~2.1 MB, ~6 s |

**What the data looks like**
- One request per dataset is enough; no splitting into smaller requests is needed. No API key is needed.
- Forecasts are published **8 times a day** at 02:30, 04:30, 07:30, 09:30, 11:30, 15:30, 18:30 and 22:30 UTC.
  The 11:30 forecast was once published late at **12:25**, so the code must not assume fixed publish times.
- Each forecast also includes rows for hours that have already passed (**negative horizon**). Those are never
  picked, because we only use forecasts published before the cutoff for a later delivery day.
- January is GMT (UK time = UTC), but the code still uses `Europe/London` so it would stay correct in summer.

**Scope:** decision days **Jan 1–31, 2026** → delivery days **Jan 2 – Feb 1, 2026**.

---

## 4. Data flow

```
Elexon API ──(fails?)──► saved backup (.json.gz)
     │                          │
     └──────────┬───────────────┘
                ▼
        DataStore (loaded once, kept in memory)
         ├─ actuals_hourly   (start_time, actual_mw)
         └─ forecasts        (publish_time, start_time, forecast_mw)
                ▼
  select_decision_forecasts(forecasts, cutoff)   ← cached per cutoff
                ▼
  join with actuals_hourly → error = forecast − actual
                ▼
  metrics (summary, by hour, by horizon, daily, histogram)
                ▼
          JSON responses
```

---

## 5. Core logic

### 5.1 Actuals: half-hourly → hourly (`actuals.py`)
- Round each `startTime` down to the hour and average the two half-hours: **hourly MW = mean(HH:00, HH:30)**.
- Keep an hour only if both half-hours exist; otherwise drop it and count it as missing.
- *Assumption (goes in the README):* each WINDFOR hourly value represents the average for that hour.

### 5.2 Decision-time forecast selection (`forecasts.py`)
For every target hour `T` on delivery day `D+1`:

1. `decision_day = date(T in London time) − 1 day`
2. `cutoff_ts = decision_day + cutoff time` (London time, converted to UTC)
3. Keep forecasts with `publish_time <= cutoff_ts` (**exactly at the cutoff counts**)
4. Take the one with the **latest** `publish_time`
5. `horizon_h = (T − publish_time)` in hours

All January target hours are done in one vectorised pandas pass:

```python
df["cutoff_ts"] = df["start_time"].map(lambda t: cutoff_for_target(t, cutoff))
eligible = df[df["publish_time"] <= df["cutoff_ts"]]
chosen = eligible.loc[eligible.groupby("start_time")["publish_time"].idxmax()]
chosen["horizon_h"] = (chosen["start_time"] - chosen["publish_time"]).dt.total_seconds() / 3600
```

- **Function:** `select_decision_forecasts(forecasts: DataFrame, cutoff: time) -> DataFrame`
- **Cached** with `functools.lru_cache` keyed by cutoff, so moving the cutoff control stays fast.
- Target hours with no forecast before the cutoff are left out and counted (`missing_forecast_hours`).
- With the default 09:00 cutoff, the **07:30 forecast** is used, so horizons run from **16.5 h** (00:00) to
  **39.5 h** (23:00).

### 5.3 Error metrics (`metrics.py`)
Sign convention: **error = forecast − actual** (MW).
**Positive** = wind over-forecast → less wind than expected → **risk of buying too little power**.

| Metric | Formula | Meaning for the client |
|---|---|---|
| MAE | mean(\|e\|) | Typical size of the miss in MW |
| RMSE | sqrt(mean(e²)) | Like MAE, but weighs big misses more |
| Bias | mean(e) | Does the forecast lean high or low? |
| nMAE % | MAE / mean(actual) × 100 | Error as a share of typical output |
| P10 / P50 / P90 | percentiles of e | Range the error usually falls in |
| P90 \|e\| | 90th percentile of \|e\| | "90% of hours miss by less than X MW" |
| Max over / under | max(e), min(e) | Worst cases |
| **Buffer recommendation** | **P90 of e** | "Plan for **X MW less wind** than forecast to be covered in 90% of hours" |

**Breakdowns**
- **By hour of day** (0–23): MAE, bias, P10, P90, n
- **By horizon**, in 6-hour buckets (0–6 h, 6–12 h, … up to about 66 h): MAE, bias, P10, P90, n.
  This uses **every forecast published before each target hour**, not just the one picked at the cutoff, so it
  doesn't depend on the cutoff. (With one fixed cutoff, each hour of day always has the same lead time, so the
  picked forecasts alone would only repeat "by hour".) It shows how accuracy improves closer to delivery:
  MAE is 1.69 GW at 0–6 h ahead and 2.33 GW at 42–48 h ahead.
- **Daily**, per delivery day: MAE, bias, forecast and actual energy (MWh)
- **Histogram** of errors: 500 MW bins, as `{bin_start, bin_end, count}`

**Uncertainty band for the day-ahead chart:** using that hour's January error percentiles,
`band_low = forecast − P90(e_hour)` and `band_high = forecast − P10(e_hour)`.
*Limitation (goes in the README):* the band uses the whole month's statistics. In production it would use only
past days, to avoid using information that wasn't yet known.

**Functions:** `summary(df)`, `recommendation(df)`, `by_hour(df)`, `by_horizon(forecasts, actuals_hourly)`,
`daily(df)`, `histogram(df, bin_mw=500)`, `add_uncertainty_band(points, hour_stats)`.
Each is a pure function on DataFrames/Series, so it's easy to test.

---

## 6. Data loading and caching (`store.py`, `elexon.py`, `snapshot.py`)

- **`ElexonClient`**
  - `fetch_wind_actuals(from_date, to_date)` and `fetch_wind_forecasts(publish_from, publish_to)`
  - `httpx.Client` with a 30 s timeout and 3 retries (with back-off) on network errors and 5xx responses
  - Parses timestamps as UTC, keeps only the needed fields, and filters `fuelType == "WIND"` as an extra safeguard
- **`DataStore`**
  - Loads data the first time it's needed and only once, protected by a lock so two simultaneous requests can't
    both load it
  - Source order is set by the `DATA_SOURCE` env var:
    - `auto` (default): live, falling back to the snapshot
    - `live`: live only
    - `snapshot`: snapshot only
  - Exposes `actuals_hourly`, `forecasts`, `source` (`"live"` / `"snapshot"`) and `fetched_at`
- **Snapshot**
  - `python -m app.snapshot` fetches the live data and writes the gzipped JSON backup files (~300 KB total)
  - The backup is committed to the repo, so demos, tests and Vercel cold starts never depend on Elexon being up
  - Vercel (Docker too) uses `DATA_SOURCE=snapshot`, so first requests are fast; local development uses `auto`

---

## 7. API specification

All routes live under the **`/api`** prefix, so the same paths work locally, in Docker (Nginx forwards `/api`)
and on Vercel. Swagger UI is available at `/api/docs`.

### `GET /api/health`
```json
{ "status": "ok" }
```

### `GET /api/meta`
```json
{
  "decision_date_min": "2026-01-01",
  "decision_date_max": "2026-01-31",
  "default_cutoff": "09:00",
  "timezone": "Europe/London",
  "publish_times_utc": ["02:30", "04:30", "07:30", "09:30", "11:30", "15:30", "18:30", "22:30"],
  "data_source": "live",
  "fetched_at": "2026-10-24T12:00:00Z"
}
```

### `GET /api/day-ahead?decision_date=2026-01-15&cutoff=09:00`
| Param | Type | Rules |
|---|---|---|
| `decision_date` | date | Required; 2026-01-01 … 2026-01-31 |
| `cutoff` | `HH:MM` | Optional; defaults to `09:00` |

```json
{
  "decision_date": "2026-01-15",
  "delivery_date": "2026-01-16",
  "cutoff": "09:00",
  "forecast_publish_times": ["2026-01-15T07:30:00Z"],
  "summary": {
    "forecast_energy_mwh": 251000, "actual_energy_mwh": 238500,
    "peak_forecast_mw": 14200, "min_forecast_mw": 7900,
    "mae_mw": 950, "bias_mw": 520
  },
  "points": [
    {
      "start_time": "2026-01-16T00:00:00Z",
      "forecast_mw": 9800, "actual_mw": 9350, "error_mw": 450,
      "band_low_mw": 7600, "band_high_mw": 10900,
      "publish_time": "2026-01-15T07:30:00Z", "horizon_h": 16.5
    }
  ],
  "missing_forecast_hours": 0,
  "missing_actual_hours": 0
}
```

### `GET /api/accuracy?cutoff=09:00`
```json
{
  "cutoff": "09:00",
  "period": { "delivery_from": "2026-01-02", "delivery_to": "2026-02-01" },
  "n_hours": 744,
  "summary": {
    "mae_mw": 1100, "rmse_mw": 1450, "bias_mw": 300, "nmae_pct": 11.2,
    "p10_mw": -1300, "p50_mw": 250, "p90_mw": 1800, "p90_abs_mw": 2100,
    "max_over_mw": 5200, "max_under_mw": -4100
  },
  "recommendation": { "coverage": 0.9, "buffer_mw": 1800 },
  "by_hour":    [{ "hour": 0, "mae_mw": 1000, "bias_mw": 200, "p10_mw": -1200, "p90_mw": 1600, "n": 31 }],
  "by_horizon": [{ "bucket": "12-18h", "bucket_start_h": 12, "mae_mw": 1855, "bias_mw": 1654,
                   "p10_mw": -142, "p90_mw": 3735, "n": 1470 }],
  "daily":      [{ "delivery_date": "2026-01-02", "mae_mw": 800, "bias_mw": -100,
                   "forecast_energy_mwh": 240000, "actual_energy_mwh": 242000 }],
  "histogram":  [{ "bin_start_mw": -1500, "bin_end_mw": -1000, "count": 42 }]
}
```
*(The numbers above are placeholders that show the shape, not real results.)*

### Errors
| Case | Status |
|---|---|
| `decision_date` outside Jan 1–31, or not a date | `422` with a clear message |
| `cutoff` not in `HH:MM` format | `422` |
| Live fetch failed and there's no snapshot | `503` `{ "detail": "Data source unavailable" }` |

**CORS:** allow `http://localhost:5173` (Vite dev server) only. In Docker and on Vercel, the frontend and API are
served from the same address, so CORS isn't needed there.

---

## 8. Configuration (`config.py`)

| Setting | Default | Env var |
|---|---|---|
| Elexon base URL | `https://data.elexon.co.uk/bmrs/api/v1` | `ELEXON_BASE_URL` |
| Decision date range | 2026-01-01 … 2026-01-31 | – |
| Default cutoff | `09:00` | `DEFAULT_CUTOFF` |
| Timezone | `Europe/London` | – |
| Data source | `auto` | `DATA_SOURCE` |
| HTTP timeout / retries | 30 s / 3 | – |
| CORS origins | `http://localhost:5173` | `CORS_ORIGINS` |

**Why 09:00 is the default cutoff:** the GB day-ahead auctions close at about 09:20 UK time (EPEX SPOT) and
09:50 UK time (N2EX / Nord Pool). 09:00 leaves the trader time to act before both deadlines.

---

## 9. Testing plan

| File | Test cases |
|---|---|
| `test_elexon.py` | Parses fields and UTC times; drops non-WIND rows; retries then raises on 5xx (using `httpx.MockTransport`) |
| `test_actuals.py` | Two half-hours → hourly average; an hour missing a half-hour is dropped |
| `test_forecasts.py` | Picks the latest forecast before the cutoff · ignores forecasts published after it · a forecast published exactly at the cutoff counts · a late publish (12:25) is handled · hours with no eligible forecast are left out · horizon is calculated correctly |
| `test_metrics.py` | MAE, RMSE, bias and percentiles on small known arrays · buffer = P90 · empty input doesn't crash · histogram counts add up to n |
| `test_api.py` | 200 + correct shape for all endpoints (using a fake store) · 422 for a bad date or cutoff · 503 when data is unavailable |

Run with: `pytest -q`. GitHub Actions runs `ruff check` and `pytest` on every push.

---

## 10. Running and deploying

**Local**
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate      # Windows
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000           # http://localhost:8000/api/docs
```

**Docker** (`backend/Dockerfile`)
- Based on `python:3.12-slim`, runs as a non-root user, and installs only `requirements.txt`
- `CMD uvicorn app.main:app --host 0.0.0.0 --port 8000`, with a healthcheck on `/api/health`

**Vercel**
- `api/index.py` adds `backend/` to `sys.path` and exposes `app` (the FastAPI instance)
- `vercel.json`:
  - sends `/api/(.*)` → `api/index.py`
  - includes `backend/**` (code + snapshot) in the function bundle
- `DATA_SOURCE=snapshot` is set in the Vercel project settings
- Bundle size (pandas + numpy ≈ 120 MB) is within Vercel's 250 MB limit

---

## 11. Task checklist (in order)

> The detailed step-by-step tasks, with review checkpoints, are in [BACKEND_TASKS.md](BACKEND_TASKS.md).

| # | Task | Time | Done |
|---|---|---|---|
| 1 | Set up the project: folders, requirements, `pyproject.toml`, ruff config | 10 min | ☐ |
| 2 | `config.py`, `elexon.py` + `test_elexon.py` | 20 min | ☐ |
| 3 | `snapshot.py` → generate and commit the backup data | 10 min | ☐ |
| 4 | `actuals.py` + tests | 10 min | ☐ |
| 5 | `forecasts.py` (selection) + tests | 25 min | ☐ |
| 6 | `metrics.py` + tests | 25 min | ☐ |
| 7 | `store.py` (lazy loading, fallback, cache per cutoff) | 15 min | ☐ |
| 8 | `schemas.py`, `routes.py`, `main.py` + `test_api.py` | 30 min | ☐ |
| 9 | Check real results by hand (do the numbers make sense? spot-check a few hours against the raw API data) | 10 min | ☐ |
| 10 | Dockerfile, test the container | 10 min | ☐ |
| | **Total** | **~2 h 45 min** | |

---

## 12. Assumptions and limitations (to copy into the README)

1. Each WINDFOR hourly value is compared with the **average of the two half-hourly actuals** in that hour.
2. Decision cutoff defaults to **09:00 UK time** on the decision day; the user can change it.
3. A forecast published **exactly at** the cutoff counts as available.
4. The uncertainty band and buffer use **all of January's** error statistics (a pilot analysis, which includes
   later days); a production version would use only past days.
5. Only national wind from Elexon FUELHH / WINDFOR is used, as the brief requires.
6. **Finding:** WINDFOR forecasts are consistently higher than FUELHH actuals (bias about +1.75 GW in January),
   and the gap grows with wind level (+0.8 GW below 6 GW, +2.5 GW above 14 GW). A likely cause is curtailment
   (wind farms paid to reduce output because of grid limits). **This is not confirmed**; present it as a likely
   explanation only.
