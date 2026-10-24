# Frontend Tasks

Step-by-step task list for building the frontend. The design is in [FRONTEND_PLAN.md](FRONTEND_PLAN.md); the
API it uses is finished and documented in [BACKEND_PLAN.md](BACKEND_PLAN.md) (types in FRONTEND_PLAN §5).

## How we work

Same as the backend:

```
 ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
 │ 1. Build     │ →  │ 2. Check     │ →  │ 3. Review    │ →  │ 4. Done      │
 │ Claude writes│    │ tests, lint, │    │ you review,  │    │ mark ✅,     │
 │ the code     │    │ build pass   │    │ ask, approve │    │ commit, next │
 └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                ↓ changes needed
                                          back to step 1
```

**Rules**
1. **One task at a time.** The next task starts only after the current one is ✅.
2. **Every task ends with a review:** Claude shows what changed, the test and build output, and (for UI tasks)
   **screenshots** of the real app running against the real backend. You approve, or ask for changes.
3. **After approval:** mark the task ✅, add a row to the [review log](#review-log), commit
   (`frontend: task N – <title>`) and push.
4. **Tests are written with each task**, not saved for the end.
5. **Standard checks for every task:** `npm run lint`, `npm run format:check`, `npm test` and `npm run build`
   all pass.

**Status key:** ⬜ Not started · 🔄 In progress · 👀 In review · ✅ Done

---

## Overview

| # | Task | Time | Status |
|---|---|---|---|
| 1 | [Project setup](#task-1--project-setup) | 15 min | ✅ |
| 2 | [Styles, colours and number formats](#task-2--styles-colours-and-number-formats) | 15 min | ✅ |
| 3 | [API layer and URL state](#task-3--api-layer-and-url-state) | 20 min | ✅ |
| 4 | [App shell (header, tabs, loading/error states)](#task-4--app-shell) | 15 min | ✅ |
| 5 | [Day-ahead view](#task-5--day-ahead-view) | 40 min | ⬜ |
| 6 | [Forecast accuracy view](#task-6--forecast-accuracy-view) | 45 min | ⬜ |
| 7 | [Responsive layout, accessibility, polish](#task-7--responsive-layout-accessibility-polish) | 15 min | ⬜ |
| 8 | [Docker + docker compose (full stack)](#task-8--docker--docker-compose) | 20 min | ⬜ |
| 9 | [End-to-end check in the browser](#task-9--end-to-end-check-in-the-browser) | 15 min | ⬜ |
| | **Total** | **~3 h 20 min** (including reviews) | |

> After the frontend: a short **deployment and submission** phase (Vercel, README, CI on GitHub, video script),
> with its own task file.

---

## Task 1 – Project setup
**Status:** ✅ Done · **Depends on:** backend done

**Files**
- `frontend/` (from the Vite `react-ts` template, create-vite 9.3): `package.json`, `package-lock.json`,
  `vite.config.ts`, `tsconfig*.json`, `.oxlintrc.json`, `index.html`, `src/main.tsx`, `src/App.tsx`
- `frontend/.npmrc` (`save-exact=true`), `.prettierrc.json`, `.prettierignore`
- `frontend/src/test/setup.ts`, `frontend/src/test/App.test.tsx` (all tests live in `src/test/`)

**Steps**
- [x] Create the project with `npm create vite@latest frontend -- --template react-ts`, then delete the demo
      content (logos, counter, demo CSS, template README)
- [x] Add dependencies: `recharts`, `@tanstack/react-query`
- [x] Add dev dependencies: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`,
      `@testing-library/user-event`, `prettier`
- [x] **Pin exact versions** (`save-exact`), as in the backend (the template's own `^`/`~` ranges too)
- [x] `package.json` scripts: `dev`, `build`, `preview`, `lint`, `test`, `test:watch`, `format`, `format:check`
- [x] `vite.config.ts`: dev proxy `/api` → `http://localhost:8000`, plus Vitest settings (jsdom, setup file)
- [x] Placeholder `App` ("Wind Forecast Monitor") and one smoke test
- [x] Changed: the template now uses **oxlint** instead of ESLint; kept it, and made warnings fail the check
      (`--deny-warnings`)

**Done when**
- [x] `npm run dev` serves the page, and `/api/health` **through the Vite proxy** returns `{"status":"ok"}`
      (`/api/meta` too, with real data)
- [x] `npm run build`, `npm run lint`, `npm run format:check` and `npm test` all pass

**Review checklist**
- Versions pinned? Nothing unnecessary added? No demo files left over?

---

## Task 2 – Styles, colours and number formats
**Status:** ✅ Done · **Depends on:** 1

**Files:** `src/styles/global.css`, `src/lib/colors.ts`, `src/lib/format.ts`, `src/test/format.test.ts`,
`src/test/colors.test.ts`, `tsconfig.test.json` (tests get Node types; app code doesn't)

**Steps**
- [x] `global.css`: CSS variables (colours, spacing, radius, fonts), a small reset, the page layout (content at
      most 1200 px wide, 16 px side margins on phones), and the card style; **plus dark-mode values**
- [x] `colors.ts`: the chart colours in one place. Changed from the plan's guesses to a **validated
      palette** (forecast blue, actual orange, band light blue, over-forecast red, under-forecast blue),
      checked with the palette validator in light and dark mode
- [x] `format.ts`:
  - `formatPower`: below 10,000 MW → `9,350 MW`, otherwise → `14.2 GW`
  - `formatEnergy`: MWh in → `251 GWh` out
  - `formatSigned`: always shows a sign, with a real minus character (`+520 MW`, `−1.3 GW`)
  - `formatUkTime` / `formatUkDate`: `Intl` with `timeZone: "Europe/London"`
  - `formatHoursAhead`: `16.5 h`

**Tests**
- [x] MW/GW switch at 10,000 MW · GWh conversion · signs, including zero · UK time in winter and summer (BST)
- [x] Extra: every chart colour has a light and a dark value in `global.css`

**Done when:** standard checks pass ✓ (23 tests)

**Review checklist**
- Are all colours defined once? Do the formats match the design (FRONTEND_PLAN §6)?

---

## Task 3 – API layer and URL state
**Status:** ✅ Done · **Depends on:** 1

**Files**
- `src/api/types.ts`, `src/api/client.ts`, `src/api/hooks.ts`, `src/env.d.ts` (type for `VITE_API_BASE_URL`)
- `src/state/useUrlState.ts`
- `src/test/client.test.ts`, `src/test/useUrlState.test.ts`

**Steps**
- [x] `types.ts`: exactly the types in FRONTEND_PLAN §5, which mirror `backend/app/schemas.py`
      → **checked automatically against the backend's OpenAPI schema: 77 fields in 12 models, names and
      nullability identical**
- [x] `client.ts`:
  - `getJson<T>(path, params)`; base URL from `VITE_API_BASE_URL`, defaulting to the same address
  - `ApiError(status, message)`, which reads `detail` whether it's a string or FastAPI's list of `{ msg }`
    (status 0 = server unreachable)
  - `getMeta()`, `getDayAhead(date, cutoff)`, `getAccuracy(cutoff)`
- [x] `hooks.ts`:
  - `useMeta`, `useDayAhead`, `useAccuracy`. All results never go stale (January's data doesn't change);
    unused results are dropped after 10 min; the previous data stays on screen while new data loads
  - no refetch when the browser window regains focus
  - retries network/5xx errors up to 2 times, never 4xx (`shouldRetry`, same rule as the backend client)
  - `createQueryClient()` with these defaults, used by the app in Task 4
- [x] `useUrlState`:
  - keeps `tab`, `date` and `cutoff` in the URL using `history.replaceState`
  - bad values fall back to the defaults (day-ahead tab, 2026-01-31, 09:00)
  - changed: the allowed dates and default cutoff are **passed in from `/api/meta`** instead of being
    hard-coded, so the backend stays the single source of truth

**Tests**
- [x] `ApiError` message from a string `detail`, from a list `detail`, and on a network failure
- [x] `useUrlState` reads valid values, falls back on invalid ones, and updates the URL when they change
- [x] Extra: URLs built correctly · non-JSON error body · retry policy · impossible dates rejected ·
      no browser-history entries added

**Done when:** standard checks pass ✓ (42 tests)

**Review checklist**
- Do the types match `schemas.py` field for field (including which fields can be `null`)?
- Do components never call `fetch` directly, only through the hooks?

---

## Task 4 – App shell
**Status:** ✅ Done · **Depends on:** 2, 3

**Files**
- `src/main.tsx`, `src/App.tsx` (+ `App.module.css`), `src/lib/cutoffs.ts` (the cutoff options)
- `src/components/layout/Header.tsx`, `Tabs.tsx` (+ `TabPanel`), `DataSourceBadge.tsx`, `Footer.tsx` (+ CSS Modules)
- `src/components/feedback/LoadingState.tsx`, `ErrorState.tsx`, `EmptyState.tsx` (+ `feedback.module.css`)
- `src/pages/DayAheadPage.tsx`, `AccuracyPage.tsx`: placeholders, replaced in Tasks 5 and 6
- `src/test/App.test.tsx`, `src/test/render.tsx` (fake API + render helper), `src/test/fixtures.ts`

**Steps**
- [x] `QueryClientProvider` in `main.tsx`
- [x] Header:
  - title and scope line ("GB national wind · day-ahead decisions for January 2026")
  - **data source badge** (`Live data` / `Saved snapshot`). Changed: the `fetched_at` time is shown as
    visible text next to it, not on hover, so it also works on touch screens and with the keyboard
- [x] Tabs: "Day-ahead view" / "Forecast accuracy" with ARIA tab roles and arrow-key navigation (plus Home/End);
      the active tab is kept in the URL
- [x] Loading state (grey blocks shaped like the content, no animation if the user prefers reduced motion),
      error state (message + **Retry** button; shows loading while retrying), empty state
- [x] Extra: footer naming the data source; clearer message when the backend is down (502–504)

**Tests**
- [x] The app renders the header and badge from a faked `/api/meta` (incl. the fetched time in UK summer time)
- [x] Switching tabs updates the URL
- [x] A 503 shows the error state, and Retry calls the API again
- [x] Extra: snapshot badge · arrow keys move between tabs

**Done when**
- [x] Standard checks pass (47 tests)
- [x] Against the real backend: the badge shows **Live**; with the backend stopped, the error state and Retry work
- [x] Screenshots in the review (light, dark, error, and a shared link opening the accuracy tab)

**Review checklist**
- Do the tabs work with the keyboard? Does the page avoid jumping around while data loads?

---

## Task 5 – Day-ahead view
**Status:** ⬜ · **Depends on:** 4

**Files**
- `src/pages/DayAheadPage.tsx`
- `src/components/controls/DecisionControls.tsx`, `ActualsToggle.tsx`
- `src/components/cards/KpiCard.tsx`
- `src/components/charts/ForecastChart.tsx`, `ChartTooltip.tsx`
- `src/test/DecisionControls.test.tsx`, `src/test/DayAheadPage.test.tsx`

**Steps**
- [ ] Controls:
  - decision date (`<input type="date">` limited to Jan 1–31)
  - cutoff select: `07:00`, `08:00`, `09:00` (default), `09:20 (EPEX close)`, `09:50 (N2EX close)`, `11:00`, `12:00`
- [ ] Info line: *"Using the forecast published 15 Jan 07:30 · delivery day Fri 16 Jan"*
- [ ] Summary cards:
  - forecast energy (GWh)
  - peak / low forecast
  - hours ahead (e.g. 16.5–39.5 h)
  - actual vs forecast (MAE + bias), shown only when actuals are on
- [ ] `ForecastChart`:
  - P10–P90 band (shaded area) + forecast (solid line) + actual (dashed line)
  - x-axis in UK time, with a shared tooltip
- [ ] **Show actuals** toggle: hides the actual line and its card, to show what the trader saw at the time
- [ ] Notes for missing data: *"2 hours without a forecast at this cutoff"* (e.g. at 00:00) and missing actual
      hours; an empty state when there's no forecast at all

**Tests**
- [ ] `DecisionControls`: the date is limited to January; changing the cutoff calls `onChange`
- [ ] `DayAheadPage` (faked API): shows the summary cards and the "Using the forecast published …" line; the
      toggle hides the actual card; a 503 shows the error state

**Done when**
- [ ] Standard checks pass
- [ ] With real data: decision **Jan 27** shows forecast **267 GWh** vs actual **138 GWh**; cutoff 09:50 switches
      to the **09:30** forecast; cutoff 00:00 shows the "2 hours without a forecast" note
- [ ] Screenshots in the review (actuals on and off)

**Review checklist**
- Is the chart easy to read? Can the band, forecast and actual be told apart without colour (dashed line)?
- Does it match the sketch in FRONTEND_PLAN §3?

---

## Task 6 – Forecast accuracy view
**Status:** ⬜ · **Depends on:** 5

**Files**
- `src/pages/AccuracyPage.tsx`
- `src/components/cards/RecommendationCard.tsx`, `InfoTip.tsx`
- `src/components/charts/ErrorByHourChart.tsx`, `ErrorHistogram.tsx`, `DailyErrorChart.tsx`, `HorizonChart.tsx`
- `src/test/AccuracyPage.test.tsx`

**Steps**
- [ ] Cutoff control + period line ("Delivery 2 Jan – 1 Feb 2026 · 744 hours")
- [ ] 5 summary cards (MAE, RMSE, bias, nMAE, P90 miss), each with an ⓘ tooltip in plain English
- [ ] `RecommendationCard`: *"To be covered in 90% of hours, plan for 4.1 GW less wind than the forecast"*,
      plus a bias sentence (*"Wind was over-forecast on average by 1.7 GW, so there's a risk of buying too little"*)
- [ ] `ErrorByHourChart`: MAE bars + P10–P90 band + bias line, by UK hour
- [ ] `ErrorHistogram`: bars coloured by over-/under-forecast, with P10/P50/P90 markers
- [ ] `DailyErrorChart`: MAE per delivery day; **clicking a bar opens the day-ahead view for that day**
      (decision date = delivery date − 1)
- [ ] `HorizonChart`: MAE by hours ahead, with a note that it uses all forecasts (so it doesn't change with the
      cutoff); buckets with fewer than 100 hours are shown faded

**Tests**
- [ ] `AccuracyPage` (faked API): shows the summary cards and the recommendation sentence with the right value
- [ ] Clicking a day calls the navigation with decision date = delivery date − 1

**Done when**
- [ ] Standard checks pass
- [ ] With real data at 09:00: MAE **2.04 GW**, bias **+1.75 GW**, buffer **4.1 GW**; clicking **28 Jan** opens
      the day-ahead view for decision date **27 Jan**
- [ ] Screenshot in the review

**Review checklist**
- Is the recommendation wording accurate and not overstated?
- Is each chart understandable without explanation?

---

## Task 7 – Responsive layout, accessibility, polish
**Status:** ⬜ · **Depends on:** 6

**Steps**
- [ ] Check at **375 px** (phone), **768 px** (tablet) and **1280 px** (laptop): cards wrap, charts stack, no
      sideways scrolling
- [ ] Every chart has an `aria-label` summary; every input has a label; focus outlines are visible
- [ ] ⓘ tooltips open on keyboard focus as well as hover
- [ ] Page title and favicon; consistent spacing and number formats everywhere
- [ ] No warnings or errors in the browser console

**Done when**
- [ ] Standard checks pass
- [ ] Screenshots at the 3 widths in the review

**Review checklist**
- Would this look good on a projector during the client demo? And on a phone?

---

## Task 8 – Docker + docker compose
**Status:** ⬜ · **Depends on:** 7

**Files**
- `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/.dockerignore`
- `docker-compose.yml` (repo root)

**Steps**
- [ ] `frontend/Dockerfile`, in two stages:
  1. `node:24-alpine`: `npm ci && npm run build`
  2. `nginxinc/nginx-unprivileged:alpine` (runs as non-root, port 8080): serves `dist/`
- [ ] `nginx.conf`:
  - forwards `/api/` → `http://backend:8000`
  - unknown paths fall back to `index.html`
  - built JS/CSS files are cached long-term
  - gzip on
- [ ] `docker-compose.yml`:
  - `backend` service (with its healthcheck)
  - `frontend` service that waits until the backend is healthy
  - port **8080**

**Done when**
- [ ] `docker compose up --build` → http://localhost:8080 shows the app with real data; `/api` works through Nginx
- [ ] Image sizes noted; both containers run as non-root

**Review checklist**
- Is the one-command start simple enough for the README? Are the containers non-root?

---

## Task 9 – End-to-end check in the browser
**Status:** ⬜ · **Depends on:** 8

**Steps**
- [ ] Run the full stack (`docker compose up`) and walk through the **demo script** (FRONTEND_PLAN §12) step by step
- [ ] Compare the numbers on screen with the API and the headline numbers (BACKEND_TASKS, Task 10)
- [ ] Check the browser console for errors and the network tab for failed requests
- [ ] Save screenshots for the README and the video

**Done when**
- [ ] Every demo step works; the numbers match; no console errors
- [ ] Screenshots saved in `docs/screenshots/`

**Review checklist**
- Is the demo ready to record?

---

## Review log

| Task | Date | Result | Notes |
|---|---|---|---|
| 1 – Project setup | 2026-10-24 | ✅ Approved | Vite 8 + React 19 + TS 6, exact versions, 0 vulnerabilities; oxlint (template default) with `--deny-warnings`; Prettier; Vitest + Testing Library; Vite proxy to the backend verified |
| 2 – Styles, colours, formats | 2026-10-24 | ✅ Approved | Validated palette (colour-blind ΔE 19–27, ≥ 3:1) in light and dark; dark mode included; formats with real minus sign and UK time (BST tested); separate test tsconfig; 23 tests |
| 3 – API layer, URL state | 2026-10-24 | ✅ Approved | Types verified against the backend OpenAPI schema (77 fields, 12 models identical); readable `ApiError`s; never-stale cache, keep previous data, retry 5xx not 4xx; URL state with limits from `/api/meta`; 42 tests |
| 4 – App shell | 2026-10-24 | ✅ Approved | Header with Live/Snapshot badge and visible fetch time; keyboard tabs kept in the URL; loading/error/empty states; screenshots caught an unhelpful 502 message and a CSS order bug (both fixed); 47 tests |
