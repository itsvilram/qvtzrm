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
| 5 | [Actuals: half-hourly → hourly](#task-5--actuals-half-hourly--hourly) | 15 min | ⬜ |
| 6 | [Decision-time forecast selection](#task-6--decision-time-forecast-selection) | 30 min | ⬜ |
| 7 | [Error metrics](#task-7--error-metrics) | 30 min | ⬜ |
| 8 | [DataStore (loading + cache)](#task-8--datastore-loading--cache) | 20 min | ⬜ |
| 9 | [API endpoints](#task-9--api-endpoints) | 35 min | ⬜ |
| 10 | [Check results against real data](#task-10--check-results-against-real-data) | 15 min | ⬜ |
| 11 | [Dockerfile](#task-11--dockerfile) | 15 min | ⬜ |
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
**Status:** ⬜ · **Depends on:** 3

**Files:** `backend/app/actuals.py`, `backend/tests/test_actuals.py`

**Steps**
- [ ] `to_hourly(actuals) -> DataFrame[start_time, actual_mw]`
  - Round each time down to the hour and average the two half-hours
  - Keep an hour only if both half-hours exist

**Tests**
- [ ] 00:00 = 100 and 00:30 = 200 → 00:00 = 150
- [ ] An hour with only one half-hour is dropped
- [ ] Output is sorted with no duplicates

**Done when:** tests pass and ruff passes

**Review checklist**
- Is the averaging assumption written in the function docstring?

---

## Task 6 – Decision-time forecast selection
**Status:** ⬜ · **Depends on:** 2, 3 · ⭐ **Core logic: review carefully**

**Files:** `backend/app/forecasts.py`, `backend/tests/test_forecasts.py`

**Steps**
- [ ] `cutoff_for_target(start_time, cutoff) -> UTC timestamp`: the day before the target's London date, at
      `cutoff` London time
- [ ] `select_decision_forecasts(forecasts, cutoff) -> DataFrame[start_time, forecast_mw, publish_time, horizon_h, decision_date]`
  - keep `publish_time <= cutoff_ts`
  - pick the latest `publish_time` for each `start_time`
- [ ] Keep only target hours on delivery days (Jan 2 – Feb 1)

**Tests**
- [ ] Picks the latest forecast before the cutoff (e.g. with cutoff 09:00, picks 07:30, not 04:30)
- [ ] Ignores a forecast published after the cutoff (09:30)
- [ ] A forecast published exactly at the cutoff counts
- [ ] A late publish (12:25 instead of 11:30) works with cutoff 13:00
- [ ] Target hours with no eligible forecast are left out
- [ ] `horizon_h` is correct (07:30 → next day 00:00 = 16.5 h)
- [ ] `decision_date` is the delivery day minus 1

**Done when**
- [ ] Tests pass
- [ ] Run on the real data with cutoff 09:00: 744 target hours, all using a 07:30 publish, horizons 16.5–39.5 h

**Review checklist**
- Is the London-time handling right (`cutoff` is UK time, data is UTC)?
- Is "at or before the cutoff" (`<=`) intended and documented?
- Is it vectorised (no slow loops over rows)?

---

## Task 7 – Error metrics
**Status:** ⬜ · **Depends on:** 5, 6

**Files:** `backend/app/metrics.py`, `backend/tests/test_metrics.py`

**Steps**
- [ ] `join_actuals(selected, actuals_hourly) -> DataFrame` with `error_mw = forecast_mw − actual_mw`
- [ ] `summary(errors, actuals)`: MAE, RMSE, bias, nMAE %, P10/P50/P90, P90 of absolute error, max over/under
- [ ] `recommendation(errors, coverage=0.9) -> buffer_mw` (= P90 of the error)
- [ ] `by_hour(df)`: for each UK hour 0–23: MAE, bias, P10, P90, n
- [ ] `by_horizon(df, bucket_h=6)`: MAE, bias, n per bucket
- [ ] `daily(df)`: per delivery day: MAE, bias, forecast and actual energy (MWh)
- [ ] `histogram(errors, bin_mw=500)`
- [ ] `uncertainty_band(forecast_mw, hour, by_hour)` → `(low, high)` = `forecast − P90`, `forecast − P10`

**Tests**
- [ ] Known inputs give known results: errors `[−2, 0, 2]` → MAE 1.33, RMSE 1.63, bias 0
- [ ] Sign convention: forecast 10 and actual 8 → error +2 (over-forecast)
- [ ] Percentiles match `numpy.percentile`
- [ ] Histogram counts add up to n
- [ ] Empty input → `None`/0, no crash
- [ ] Hourly energy: 24 hours at 1,000 MW = 24,000 MWh

**Done when:** tests pass and ruff passes

**Review checklist**
- Is the sign convention (forecast − actual) the same everywhere?
- Is it clear that nMAE divides by mean actual, not by each hour (avoiding the divide-by-zero problem of percentage error)?
- Are all functions pure (no I/O)?

---

## Task 8 – DataStore (loading + cache)
**Status:** ⬜ · **Depends on:** 3, 4, 5, 6, 7

**Files:** `backend/app/store.py`, `backend/tests/test_store.py`

**Steps**
- [ ] `DataStore(source="auto"|"live"|"snapshot", client=None)`
- [ ] Loads on first use and only once (protected by `threading.Lock`)
- [ ] `auto` mode: try live; if that fails, log a warning and use the snapshot
- [ ] Exposes `actuals_hourly`, `forecasts`, `source`, `loaded_at`
- [ ] `analysis(cutoff)`: selection + join, cached per cutoff (`lru_cache`)
- [ ] `get_store()` returns one shared store for the FastAPI app
- [ ] Raises `DataUnavailableError` if no source works

**Tests** (using a fake client)
- [ ] `auto` with live failing → uses the snapshot, `source == "snapshot"`
- [ ] Loads only once across repeated calls
- [ ] `analysis(cutoff)` is cached (second call returns the same object)
- [ ] Both sources failing → `DataUnavailableError`

**Done when:** tests pass and ruff passes

**Review checklist**
- Is it safe when two requests arrive at once? Is the fallback logged? Is the cache size limited?

---

## Task 9 – API endpoints
**Status:** ⬜ · **Depends on:** 8

**Files:** `backend/app/schemas.py`, `backend/app/routes.py`, `backend/app/main.py`, `backend/tests/test_api.py`

**Steps**
- [ ] `schemas.py`: Pydantic models for `Meta`, `DayAhead` (+ `DayAheadPoint`, `DayAheadSummary`) and
      `Accuracy` (+ its parts), as specified in the plan
- [ ] `routes.py`: `APIRouter(prefix="/api")` with:
  - [ ] `GET /health`
  - [ ] `GET /meta`
  - [ ] `GET /day-ahead?decision_date&cutoff`
  - [ ] `GET /accuracy?cutoff`
- [ ] Validation: `decision_date` within Jan 1–31 and `cutoff` in `HH:MM` format, otherwise `422`
- [ ] `DataUnavailableError` → `503`
- [ ] `main.py`: create the app, add CORS from config, add the router, docs at `/api/docs`
- [ ] The store is supplied through FastAPI's dependency injection (`Depends(get_store)`), so tests can replace it

**Tests** (`TestClient` + a fake store)
- [ ] All 4 endpoints → 200, with responses matching the schemas
- [ ] `decision_date=2026-02-15` → 422; `cutoff=9am` → 422
- [ ] Store raises → 503

**Done when**
- [ ] All tests pass and ruff passes
- [ ] `uvicorn app.main:app --reload` → `/api/docs` opens, and every endpoint works there against real data

**Review checklist**
- Do the response fields exactly match `FRONTEND_PLAN.md` §5 (the types the frontend expects)?
- Are the error messages clear for a frontend user?

---

## Task 10 – Check results against real data
**Status:** ⬜ · **Depends on:** 9

**Steps**
- [ ] Call `/api/accuracy` and `/api/day-ahead` for 3 different dates
- [ ] Spot-check 3 hours by hand against the raw Elexon responses (forecast value, publish time, actual average)
- [ ] Check the numbers make sense: wind 2–21 GW, MAE likely about 0.5–2 GW, the band contains most actuals
- [ ] Note the real headline numbers (MAE, bias, buffer) for the video

**Done when**
- [ ] The spot-checks match exactly
- [ ] The headline numbers are recorded in the review log

**Review checklist**
- Do the numbers tell a clear story for the client pitch?

---

## Task 11 – Dockerfile
**Status:** ⬜ · **Depends on:** 9

**Files:** `backend/Dockerfile`, `backend/.dockerignore`

**Steps**
- [ ] Based on `python:3.12-slim`; install `requirements.txt` only; copy `app/` and `data/`
- [ ] Run as a non-root user; `EXPOSE 8000`; `HEALTHCHECK` on `/api/health`
- [ ] `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`
- [ ] `.dockerignore`: `.venv`, `tests`, `__pycache__`, `.pytest_cache`

**Done when**
- [ ] `docker build -t wind-backend ./backend` succeeds
- [ ] `docker run -p 8000:8000 -e DATA_SOURCE=snapshot wind-backend` → `/api/health` returns ok and
      `/api/accuracy` returns data
- [ ] Image size noted (aim for under 400 MB)

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
