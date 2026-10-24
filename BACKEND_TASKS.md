# Backend Tasks

Step-by-step task list for building the backend. The design is in [BACKEND_PLAN.md](BACKEND_PLAN.md).

## How we work

```
 ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
 │ 1. Build     │ →  │ 2. Check     │ →  │ 3. Review    │ →  │ 4. Done      │
 │ Claude writes│    │ tests + lint │    │ you review,  │    │ mark ✅,     │
 │ the code     │    │ pass         │    │ ask, approve │    │ commit, next │
 └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                ↓ changes needed
                                          back to step 1
```

**Rules**
1. **One task at a time.** The next task starts only after the current one is ✅.
2. **Every task ends with a review:** Claude shows what changed, the test output, and answers to the review
   checklist. You approve, or ask for changes.
3. **After approval:** mark the task ✅, add a row to the [review log](#review-log) and make a git commit
   (`backend: task N – <title>`).
4. **"Done when" is the bar:** a task isn't finished until every box under it is ticked.

**Status key:** ⬜ Not started · 🔄 In progress · 👀 In review · ✅ Done

---

## Overview

| # | Task | Time | Status |
|---|---|---|---|
| 1 | [Project setup](#task-1--project-setup) | 15 min | ✅ |
| 2 | [Configuration](#task-2--configuration) | 10 min | ✅ |
| 3 | [Elexon API client](#task-3--elexon-api-client) | 25 min | ✅ |
| 4 | [Snapshot (backup data)](#task-4--snapshot-backup-data) | 10 min | ✅ |
| 5 | [Actuals: half-hourly → hourly](#task-5--actuals-half-hourly--hourly) | 15 min | ✅ |
| 6 | [Decision-time forecast selection](#task-6--decision-time-forecast-selection) | 30 min | ✅ |
| 7 | [Error metrics](#task-7--error-metrics) | 30 min | ✅ |
| 8 | [DataStore (loading + cache)](#task-8--datastore-loading--cache) | 20 min | ✅ |
| 9 | [API endpoints](#task-9--api-endpoints) | 35 min | ✅ |
| 10 | [Check results against real data](#task-10--check-results-against-real-data) | 15 min | ✅ |
| 11 | [Dockerfile](#task-11--dockerfile) | 15 min | ✅ |
| | **Total** | **~3 h 40 min** (including reviews) | |

> The Vercel entry point (`api/index.py`, `vercel.json`) is built in the deployment phase, after the frontend.

---

## Task 1 – Project setup
**Status:** ✅ Done · **Depends on:** –

**Files**
- `backend/app/__init__.py`, `backend/tests/__init__.py`
- `backend/requirements.txt`, `backend/requirements-dev.txt`, `backend/pyproject.toml`
- `.gitignore` (repo root)

**Steps**
- [x] Run `git init` in the repo root and add a `.gitignore` (Python, Node, `.venv`, `.env`, `dist`, IDE files)
- [x] Create the `backend/` folders as in the plan
- [x] `requirements.txt`: `fastapi`, `uvicorn[standard]`, `httpx`, `pandas`, `tzdata` (versions pinned)
- [x] `requirements-dev.txt`: `-r requirements.txt`, `pytest`, `ruff`
- [x] `pyproject.toml`: ruff rules (`E,F,I,B,UP`, line length 100) and pytest settings (`testpaths = ["tests"]`)
- [x] Create `backend/.venv` and install the dev requirements

**Done when**
- [x] `pip install -r requirements-dev.txt` succeeds
- [x] `ruff check .` passes
- [x] `pytest` runs (no tests yet, so "no tests ran" is expected)

**Review checklist**
- Versions pinned? Nothing unnecessary added?
- `.gitignore` keeps `.venv` and caches out of git?

---

## Task 2 – Configuration
**Status:** ✅ Done · **Depends on:** 1

**Files:** `backend/app/config.py`, `backend/tests/test_config.py`, `.gitattributes`

**Steps**
- [x] Constants:
  - `ELEXON_BASE_URL`, `TIMEZONE = ZoneInfo("Europe/London")`
  - `DECISION_DATE_MIN = 2026-01-01`, `DECISION_DATE_MAX = 2026-01-31`
  - `DEFAULT_CUTOFF = time(9, 0)`, `HTTP_TIMEOUT_S = 30`, `HTTP_RETRIES = 3`
- [x] Derived ranges:
  - delivery dates (Jan 2 – Feb 1)
  - forecast publish window (Dec 31 00:00 UTC – Feb 1 00:00 UTC)
- [x] Env overrides: `ELEXON_BASE_URL`, `DEFAULT_CUTOFF`, `DATA_SOURCE` (`auto|live|snapshot`), `CORS_ORIGINS`
- [x] `parse_cutoff("09:00") -> time` helper that rejects bad input with a `ValueError`

**Done when**
- [x] Importing `app.config` works and the values are correct
- [x] A bad `DATA_SOURCE` value gives a clear error
- [x] Ruff passes (`ruff check` + `ruff format --check`); 16 tests pass

**Review checklist**
- Is everything configurable in one place, with no magic numbers elsewhere?
- Are the date ranges right (decision Jan 1–31 → delivery Jan 2 – Feb 1)?

---

## Task 3 – Elexon API client
**Status:** ✅ Done · **Depends on:** 2

**Files:** `backend/app/elexon.py`, `backend/tests/test_elexon.py`

**Steps**
- [x] `ElexonClient(base_url, timeout, retries, transport=None)`. The `transport` parameter lets tests swap in
      a fake.
- [x] `fetch_wind_actuals(from_date, to_date) -> DataFrame[start_time, generation_mw]`
  - FUELHH stream with `fuelType=WIND`, plus a client-side WIND filter as an extra safeguard
- [x] `fetch_wind_forecasts(publish_from, publish_to) -> DataFrame[publish_time, start_time, generation_mw]`
- [x] All times parsed as UTC (`pd.to_datetime(..., utc=True)`)
- [x] Retry with back-off on network errors and 5xx responses; after the final retry, raise `ElexonError`

**Tests** (using `httpx.MockTransport`)
- [x] Parses fields and UTC times correctly
- [x] Drops rows that aren't WIND
- [x] Retries on a 5xx response and succeeds on the next attempt (plus a network error case)
- [x] Raises `ElexonError` after all retries fail
- [x] An empty response gives an empty DataFrame with the correct columns
- [x] Extra: 4xx is not retried; an unexpected JSON shape raises `ElexonError`

**Done when**
- [x] `pytest tests/test_elexon.py` passes and ruff passes (24 tests in total)
- [x] A quick manual call against the real API returns 1,488 actual rows and about 18,688 forecast rows
      → exactly 1,488 and 18,688 (256 forecasts), in about 1.5 s each

**Review checklist**
- Are timeouts set? Are 4xx errors **not** retried?
- Is the column naming consistent (`*_mw`, `*_time`)?

---

## Task 4 – Snapshot (backup data)
**Status:** ✅ Done · **Depends on:** 3

**Files**
- `backend/app/snapshot.py`, `backend/tests/test_snapshot.py`
- `backend/data/fuelhh_wind.json.gz`, `backend/data/windfor.json.gz`

**Steps**
- [x] `python -m app.snapshot` fetches both datasets using the config ranges and writes gzipped JSON
- [x] `load_snapshot()` reads them back with the same columns and types (returns `Snapshot(actuals, forecasts, fetched_at)`)
- [x] Prints a summary: rows, date ranges, file sizes

**Done when**
- [x] Both files exist, together about 300 KB or less → **100 KB** (8 KB + 92 KB)
- [x] Loading the snapshot gives the same row counts as the live fetch → frames are **identical** (`assert_frame_equal`)
- [x] A test checks that saving and loading returns an identical DataFrame (a temp file is fine) → 3 tests, 27 in total

**Review checklist**
- Small enough to commit? Is the format readable (JSON, not pickle)?

---

## Task 5 – Actuals: half-hourly → hourly
**Status:** ✅ Done · **Depends on:** 3

**Files:** `backend/app/actuals.py`, `backend/tests/test_actuals.py`

**Steps**
- [x] `to_hourly(actuals) -> DataFrame[start_time, actual_mw]`
  - Round each time down to the hour and average the two half-hours
  - Keep an hour only if both half-hours exist (logs a warning with how many were dropped)

**Tests**
- [x] 00:00 = 100 and 00:30 = 200 → 00:00 = 150
- [x] An hour with only one half-hour is dropped
- [x] Output is sorted with no duplicates
- [x] Extra: a duplicate half-hour keeps the last value; empty input gives an empty frame with columns

**Done when:** tests pass and ruff passes ✓ (32 tests). Real data: 1,488 half-hours → 744 hours, none dropped

**Review checklist**
- Is the averaging assumption written in the function docstring?

---

## Task 6 – Decision-time forecast selection
**Status:** ✅ Done · **Depends on:** 2, 3 · ⭐ **Core logic: review carefully**

**Files:** `backend/app/forecasts.py`, `backend/tests/test_forecasts.py`

**Steps**
- [x] `decision_cutoff_utc(delivery_date, cutoff) -> UTC timestamp`: `cutoff` UK time on the day before the
      delivery date (renamed from `cutoff_for_target`; it takes the delivery date because all hours of one
      day share one cutoff)
- [x] `select_decision_forecasts(forecasts, cutoff) -> DataFrame[start_time, decision_date, publish_time, horizon_h, forecast_mw]`
  - keep `publish_time <= cutoff_ts`
  - pick the latest `publish_time` for each `start_time`
- [x] Keep only target hours on delivery days (Jan 2 – Feb 1)

**Tests**
- [x] Picks the latest forecast before the cutoff (e.g. with cutoff 09:00, picks 07:30, not 04:30)
- [x] Ignores a forecast published after the cutoff (09:30)
- [x] A forecast published exactly at the cutoff counts
- [x] A late publish (12:25 instead of 11:30) works with cutoff 13:00
- [x] Target hours with no eligible forecast are left out
- [x] `horizon_h` is correct (07:30 → next day 00:00 = 16.5 h)
- [x] `decision_date` is the delivery day minus 1
- [x] Extra: each delivery day uses its own cutoff · out-of-range targets dropped · sorted output ·
      empty input · UK summer time (09:00 BST = 08:00 UTC)

**Done when**
- [x] Tests pass (43 in total, 11 new)
- [x] Run on the real data with cutoff 09:00: 744 target hours, all using a 07:30 publish, horizons 16.5–39.5 h
      → exactly that; a separate row-by-row check gives 0 mismatches at cutoffs 00:00, 09:00, 09:50 and 13:00

**Review checklist**
- Is the London-time handling right (`cutoff` is UK time, data is UTC)?
- Is "at or before the cutoff" (`<=`) intended and documented?
- Is it vectorised (no slow loops over rows)?

---

## Task 7 – Error metrics
**Status:** ✅ Done · **Depends on:** 5, 6

**Files:** `backend/app/metrics.py`, `backend/tests/test_metrics.py`

**Steps**
- [x] `join_actuals(selected, actuals_hourly) -> DataFrame` with `error_mw = forecast_mw − actual_mw`
- [x] `summary(df)`: MAE, RMSE, bias, nMAE %, P10/P50/P90, P90 of absolute error, max over/under
- [x] `recommendation(df, coverage=0.9) -> buffer_mw` (= P90 of the error)
- [x] `by_hour(df)`: for each UK hour 0–23: MAE, bias, P10, P90, n
- [x] `by_horizon(forecasts, actuals_hourly, bucket_h=6)`: MAE, bias, P10, P90, n per bucket, using **all
      forecasts** (decided in review: with one fixed cutoff, horizon only repeats hour of day)
- [x] `daily(df)`: per delivery day: MAE, bias, forecast and actual energy (MWh)
- [x] `histogram(df, bin_mw=500)`
- [x] `add_uncertainty_band(points, hour_stats)` → `band_low = forecast − P90`, `band_high = forecast − P10`

**Tests**
- [x] Known inputs give known results: errors `[−2, 0, 2]` → MAE 1.33, RMSE 1.63, bias 0
- [x] Sign convention: forecast 10 and actual 8 → error +2 (over-forecast)
- [x] Percentiles match `numpy.percentile`
- [x] Histogram counts add up to n
- [x] Empty input → `None`/0, no crash
- [x] Hourly energy: 24 hours at 1,000 MW = 24,000 MWh
- [x] Extra: by-hour uses UK time (BST case) · horizon uses every forecast and skips late/out-of-range/no-actual rows

**Done when:** tests pass and ruff passes ✓ (56 tests). Real data at 09:00: MAE 2.04 GW, bias +1.75 GW,
buffer 4.1 GW; 81% of actuals inside the P10–P90 band

**Review checklist**
- Is the sign convention (forecast − actual) the same everywhere?
- Is it clear that nMAE divides by mean actual, not by each hour (avoiding the divide-by-zero problem of percentage error)?
- Are all functions pure (no I/O)?

---

## Task 8 – DataStore (loading + cache)
**Status:** ✅ Done · **Depends on:** 3, 4, 5, 6, 7

**Files:** `backend/app/store.py`, `backend/tests/test_store.py`, `backend/tests/samples.py` (shared sample data),
`backend/tests/conftest.py` (`snapshot` fixture)

**Steps**
- [x] `DataStore(source, client_factory, snapshot_loader)`. The data sources can be swapped in tests.
- [x] Loads on first use and only once (protected by `threading.Lock`)
- [x] `auto` mode: try live; if that fails (or returns no data), log a warning and use the snapshot
- [x] Exposes `dataset` → `actuals_hourly`, `forecasts`, `source`, `fetched_at` (renamed from `loaded_at`:
      it's when the data was fetched from Elexon, which for a snapshot is the snapshot date)
- [x] `analysis(cutoff)`: selection + join, cached per cutoff (`lru_cache`)
- [x] `horizon_stats()`: `metrics.by_horizon` worked out once and cached (it doesn't depend on the cutoff)
- [x] `get_store()` returns one shared store for the FastAPI app
- [x] Raises `DataUnavailableError` if no source works

**Tests** (using a fake client)
- [x] `auto` with live failing → uses the snapshot, `source == "snapshot"`
- [x] Loads only once across repeated calls
- [x] `analysis(cutoff)` is cached (second call returns the same object)
- [x] Both sources failing → `DataUnavailableError`
- [x] Extra: live mode doesn't fall back · snapshot mode never calls Elexon · empty live data falls back ·
      8 simultaneous requests load only once · a failed load is retried on the next request

**Done when:** tests pass and ruff passes ✓ (66 tests). Real data: live load 3.4 s; Elexon unreachable →
snapshot in 1.4 s; snapshot mode 0.13 s; analysis 72 ms first time, then 0 ms (cached)

**Review checklist**
- Is it safe when two requests arrive at once? Is the fallback logged? Is the cache size limited?

---

## Task 9 – API endpoints
**Status:** ✅ Done · **Depends on:** 8

**Files:** `backend/app/schemas.py`, `backend/app/routes.py`, `backend/app/main.py`, `backend/tests/test_api.py`,
`backend/requirements-dev.txt` (+ `httpx2` for the test client)

**Steps**
- [x] `schemas.py`: Pydantic models for `Meta`, `DayAhead` (+ `DayAheadPoint`, `DayAheadSummary`) and
      `Accuracy` (+ its parts), as specified in the plan. Numbers are rounded to 1 decimal place in responses.
- [x] `routes.py`: `APIRouter(prefix="/api")` with:
  - [x] `GET /health`
  - [x] `GET /meta`
  - [x] `GET /day-ahead?decision_date&cutoff`
  - [x] `GET /accuracy?cutoff`
- [x] Validation: `decision_date` within Jan 1–31 and `cutoff` in `HH:MM` format, otherwise `422`
- [x] `DataUnavailableError` → `503`
- [x] `main.py`: create the app, add CORS from config, add the router, docs at `/api/docs`
- [x] The store is supplied through FastAPI's dependency injection (`Depends(get_store)`), so tests can replace it
- [x] Extra: `missing_forecast_hours` in `/day-ahead` and `/accuracy` (from the Task 6 finding);
      frontend types in `FRONTEND_PLAN.md` §5 updated to match exactly

**Tests** (`TestClient` + a store using sample data)
- [x] All 4 endpoints → 200, with responses matching the schemas (exact values checked)
- [x] `decision_date=2026-02-15` → 422; `cutoff=9am` → 422 (with clear messages)
- [x] Store raises → 503
- [x] Extra: an earlier cutoff uses an earlier forecast · a day without data returns an empty day ·
      malformed or missing date → 422 · docs served

**Done when**
- [x] All tests pass and ruff passes (77 tests)
- [x] Real server against live data: every endpoint works; responses take 17–43 ms (5–10 KB);
      `/api/docs` opens; CORS allows `http://localhost:5173`

**Review checklist**
- Do the response fields exactly match `FRONTEND_PLAN.md` §5 (the types the frontend expects)?
- Are the error messages clear for a frontend user?

---

## Task 10 – Check results against real data
**Status:** ✅ Done · **Depends on:** 9

**Files:** `backend/scripts/spot_check.py`. Re-run any time with `python -m scripts.spot_check` (from `backend/`).

**Steps**
- [x] Call `/api/accuracy` and `/api/day-ahead` for 3 different dates
- [x] Spot-check 3 hours by hand against the raw Elexon responses (forecast value, publish time, actual average)
      → done with a script that uses plain Python on the raw JSON (none of the app's data code)
- [x] Check the numbers make sense: wind 2–21 GW, MAE likely about 0.5–2 GW, the band contains most actuals
      → forecast 3.2–21.1 GW, actual 1.7–17.8 GW ✓ · MAE 2.04 GW, just above the guess because of the
      +1.75 GW bias (85% of hours over-forecast) ✓ · 81% of actuals inside the P10–P90 band ✓
- [x] Note the real headline numbers (MAE, bias, buffer) for the video → see below

**Done when**
- [x] The spot-checks match exactly → 3/3 exact (Jan 2 00:00, Jan 16 12:00, Jan 28 23:00)
- [x] The headline numbers are recorded in the review log

### Headline numbers for the video (cutoff 09:00 UK, delivery 2 Jan – 1 Feb 2026, 744 hours)

| Figure | Value | How to say it |
|---|---|---|
| MAE | **2.04 GW** (nMAE 18%) | "On average the day-ahead wind forecast misses by about 2 GW" |
| Bias | **+1.75 GW**; 85% of hours over-forecast | "It almost always expects more wind than turns up" |
| Buffer (P90) | **4.1 GW** | "Plan for about 4 GW less wind than forecast to be covered 90% of the time" |
| Bias vs wind level | +0.8 GW below 6 GW → **+2.5 GW above 14 GW** | "The stronger the wind, the bigger the miss: likely curtailment (not confirmed)" |
| Lead time | MAE **2.33 GW** at 42–48 h → **1.69 GW** at 0–6 h | "Forecasts get better closer to delivery" |
| Waiting until N2EX close (09:50) | MAE 2.04 → 2.01 GW | "The 09:30 update barely helps; the morning forecasts are very similar" |
| Best day | **19 Jan**: MAE 0.74 GW (but under-forecast, bias −0.73 GW) | |
| Worst day | **28 Jan**: forecast **267 GWh**, actual **138 GWh**, MAE 5.4 GW, 0/24 hours inside the band | "On 28 Jan, relying on the forecast would have left you short by about 5 GW all day" |
| Hour of day | Best 21:00 (MAE 1.79 GW), worst 05:00 (2.43 GW) | |

**Review checklist**
- Do the numbers tell a clear story for the client pitch?

---

## Task 11 – Dockerfile
**Status:** ✅ Done · **Depends on:** 9

**Files:** `backend/Dockerfile`, `backend/.dockerignore`

**Steps**
- [x] Based on `python:3.12-slim`; install `requirements.txt` only; copy `app/` and `data/`
- [x] Run as a non-root user; `EXPOSE 8000`; `HEALTHCHECK` on `/api/health` (uses Python, as the slim image
      has no curl)
- [x] `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`
- [x] `.dockerignore`: `.venv`, `tests`, `__pycache__`, `.pytest_cache` (+ `scripts`, `.ruff_cache`, dev requirements)

**Done when**
- [x] `docker build -t wind-backend ./backend` succeeds (94 s on the first build)
- [x] `docker run -p 8000:8000 -e DATA_SOURCE=snapshot wind-backend` → `/api/health` returns ok and
      `/api/accuracy` returns data → also tested in the default `auto` mode (live Elexon from inside the
      container); both give identical numbers
- [x] Image size noted (aim for under 400 MB) → **323 MB** of files in the container (Docker Desktop
      reports 442 MB because it also counts its own storage overhead); pandas + numpy are 145 MB of that

**Also checked:** runs as `uid=10001(appuser)`; `/app` contains only `app/`, `data/`, `requirements.txt`; no
pytest/ruff/httpx2 in the image; Docker healthcheck status `healthy`.

**Review checklist**
- Non-root user? No dev dependencies or tests in the image?

---

## Review log

| Task | Date | Result | Notes |
|---|---|---|---|
| 1 – Project setup | 2026-10-24 | ✅ Approved | Pinned versions; ruff + pytest set up; assignment `.docx` kept out of git; commits use the personal identity `itsvilram`, set for this repo only |
| 2 – Configuration | 2026-10-24 | ✅ Approved | Settings in one place with env overrides; strict `HH:MM` cutoff; bad `DATA_SOURCE` stops startup; 16 tests; added `.gitattributes` (Unix line endings) and `ruff format` |
| 3 – Elexon API client | 2026-10-24 | ✅ Approved | Clean UTC tables; retries network/5xx errors but not 4xx; 8 tests with a fake server; real API: 1,488 actual rows, 18,688 forecast rows (256 forecasts) |
| 4 – Snapshot | 2026-10-24 | ✅ Approved | Gzipped JSON, 100 KB total; identical to a fresh live fetch; same data gives a byte-identical file; 3 tests |
| 5 – Hourly actuals | 2026-10-24 | ✅ Approved | Average of the two half-hours; incomplete hours dropped with a warning; 5 tests; real data 1,488 → 744 hours, none dropped |
| 6 – Forecast selection ⭐ | 2026-10-24 | ✅ Approved | 11 tests; real data at 09:00 = 744 h, all from the 07:30 forecast, 16.5–39.5 h ahead; row-by-row check 0 mismatches at 4 cutoffs; found that a 00:00 cutoff leaves 22:00–23:00 without a forecast (Task 9 must report the missing hours) |
| 7 – Error metrics | 2026-10-24 | ✅ Approved (option A) | 13 tests; `by_horizon` changed to use all forecasts (MAE 1.69 GW at 0–6 h → 2.33 GW at 42–48 h); real data at 09:00: MAE 2.04 GW, bias +1.75 GW, buffer 4.1 GW; bias grows with wind level (likely curtailment, not confirmed) |
| 8 – DataStore | 2026-10-24 | ✅ Approved | Loads once (lock, tested with 8 simultaneous requests); `auto` falls back to the snapshot (simulated Elexon outage tested); `analysis` and `horizon_stats` cached; `loaded_at` renamed `fetched_at`; 10 tests |
| 9 – API endpoints | 2026-10-24 | ✅ Approved | 4 endpoints under `/api`; clear 422/503 messages; numbers rounded to 1 dp, NaN → null; `missing_forecast_hours` added; real server 17–43 ms per request; frontend types updated to match; 11 tests (77 total) |
| 10 – Real-data checks | 2026-10-24 | ✅ Approved | 3/3 spot checks match raw Elexon exactly (`scripts/spot_check.py`); headline: MAE 2.04 GW, bias +1.75 GW (85% of hours over-forecast), P90 buffer 4.1 GW, worst day 28 Jan (267 vs 138 GWh); 81% of actuals in band; idea for later: bias-corrected forecast line |
| 11 – Dockerfile | 2026-10-24 | ✅ Approved | 323 MB of files; non-root; healthcheck `healthy`; no dev files in the image; snapshot and live (`auto`, now the Docker default) give identical results. **Backend complete: 11/11 tasks, 77 tests** |
