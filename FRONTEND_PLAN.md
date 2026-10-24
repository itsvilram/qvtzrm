# Frontend Plan – React + TypeScript

Detailed plan for the frontend of the Wind Forecast Monitor. See [PLAN.md](PLAN.md) for the full-stack overview
and [BACKEND_PLAN.md](BACKEND_PLAN.md) for the API it uses.

**Who uses it:** traders on the client's day-ahead desk. Every morning they decide how much power to buy for
tomorrow, so they need to see quickly:
1. **What does the latest wind forecast say for tomorrow?** (Tab 1 – Day-ahead view)
2. **How much can I trust it?** (Tab 2 – Forecast accuracy)

---

## 1. Tech stack

| Purpose | Choice | Why |
|---|---|---|
| Build tool | Vite | Fast dev server; its proxy forwards `/api` to the backend, so no CORS setup is needed |
| UI | React 18 + TypeScript | Required by the brief; types match the backend's response models |
| Charts | Recharts | React-friendly; can draw lines, bars and range bands; resizes automatically |
| Data fetching | TanStack Query | Built-in loading/error states and caching, so switching dates back and forth is instant |
| Styling | Plain CSS with variables + CSS Modules | No extra tooling; easy to explain |
| Date/number formatting | Built-in `Intl` (`timeZone: "Europe/London"`) | No extra library |
| Testing | Vitest + React Testing Library | Same setup as Vite; fast |
| Lint/format | ESLint + Prettier | Standard |

**Node:** 24 (installed locally); the same version is used in the Docker build stage.

---

## 2. Folder structure

```
frontend/
  index.html
  vite.config.ts           dev proxy: /api → http://localhost:8000
  package.json
  tsconfig.json
  Dockerfile               two stages: Node build → Nginx
  nginx.conf               serves the built app; forwards /api → backend:8000
  src/
    main.tsx               React root + QueryClientProvider
    App.tsx                header, tabs, page switch
    api/
      types.ts             TypeScript types matching the backend schemas
      client.ts            fetch wrapper: getMeta, getDayAhead, getAccuracy
      hooks.ts             useMeta, useDayAhead(date, cutoff), useAccuracy(cutoff)
    state/
      useUrlState.ts       keeps tab / date / cutoff in the URL (shareable links)
    pages/
      DayAheadPage.tsx
      AccuracyPage.tsx
    components/
      layout/   Header.tsx, Tabs.tsx, DataSourceBadge.tsx
      controls/ DecisionControls.tsx (date + cutoff), ActualsToggle.tsx
      cards/    KpiCard.tsx, RecommendationCard.tsx, InfoTip.tsx
      charts/   ForecastChart.tsx, ErrorByHourChart.tsx, ErrorHistogram.tsx,
                DailyErrorChart.tsx, HorizonChart.tsx, ChartTooltip.tsx
      feedback/ LoadingState.tsx, ErrorState.tsx, EmptyState.tsx
    lib/
      format.ts            MW, GWh, %, UK time formatters
      colors.ts            chart colours in one place
    styles/
      global.css           CSS variables (colours, spacing, fonts), reset, layout grid
    test/
      setup.ts
      format.test.ts
      DecisionControls.test.tsx
      DayAheadPage.test.tsx
      AccuracyPage.test.tsx
```

---

## 3. Page layout

### Header (on every page)
```
┌───────────────────────────────────────────────────────────────────────┐
│ ≋ Wind Forecast Monitor          GB national wind · Jan 2026  [Live]  │
├───────────────────────────────────────────────────────────────────────┤
│  [ Day-ahead view ]   [ Forecast accuracy ]                           │
└───────────────────────────────────────────────────────────────────────┘
```
- The `[Live]` / `[Snapshot]` badge comes from `/api/meta` (`data_source`), so it's always clear where the data
  came from.

### Tab 1 – Day-ahead view
```
┌ Decision date [2026-01-31 ▾]   Cutoff [09:00 ▾]   ☑ Show actuals (hindsight) ┐
│ Using the forecast published 31 Jan 07:30 · delivery day Sat 1 Feb            │
└───────────────────────────────────────────────────────────────────────────────┘
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Forecast    │ │ Peak / Low  │ │ Forecast    │ │ Actual vs   │
│ energy      │ │ 14.2 / 7.9  │ │ made        │ │ forecast    │
│ 251 GWh     │ │ GW          │ │ 16–40 h     │ │ MAE 950 MW  │
│             │ │             │ │ ahead       │ │ bias +520   │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
┌ Wind generation – delivery day (UK time) ─────────────────────────────────────┐
│  MW                                                                           │
│  15k ┤        ░░░░░░░░░░                         ── Forecast                  │
│      │   ░░░░▓▓▓▓▓▓▓▓▓▓░░░░                      ┄┄ Actual                    │
│  10k ┤ ░░▓▓▓▓            ▓▓▓▓░░                  ░░ Typical range (P10–P90)   │
│      │                        ▓▓▓▓░░░                                         │
│   5k ┼────┬────┬────┬────┬────┬────┬────┬                                     │
│      00   03   06   09   12   15   18   21                                    │
└───────────────────────────────────────────────────────────────────────────────┘
```
- **Default decision date:** the latest available (Jan 31), matching "the latest forecast available when
  deciding".
- **Cutoff options:** `07:00`, `08:00`, `09:00` (default), `09:20 (EPEX close)`, `09:50 (N2EX close)`,
  `11:00`, `12:00`
- **"Show actuals" toggle:** on by default. Turning it off shows exactly what the trader would have seen at the
  time; this makes a strong demo moment.
- **The last summary card** appears only when actuals are shown.

### Tab 2 – Forecast accuracy
```
┌ Cutoff [09:00 ▾]   Period: delivery 2 Jan – 1 Feb 2026 · 744 hours ──────────────┐
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ MAE     │ │ RMSE    │ │ Bias    │ │ nMAE    │ │ P90 miss│
│ 1.10 GW │ │ 1.45 GW │ │ +0.30GW │ │ 11.2 %  │ │ 2.1 GW  │
└─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
┌ Recommendation ─────────────────────────────────────────────────────────────────┐
│ ⚑ To be covered in 90% of hours, plan for 1.8 GW LESS wind than the forecast.   │
│   Wind was over-forecast on average by 0.3 GW → risk of buying too little.      │
└─────────────────────────────────────────────────────────────────────────────────┘
┌ Error by hour of day ───────────────┐ ┌ Error distribution ──────────────────┐
│ bars = MAE, band = P10–P90, line =  │ │ histogram of (forecast − actual)      │
│ bias                                │ │ with P10 / P50 / P90 markers          │
└─────────────────────────────────────┘ └──────────────────────────────────────┘
┌ Daily error over January ───────────┐ ┌ Error by how far ahead ──────────────┐
│ MAE per delivery day (click a bar → │ │ MAE vs hours ahead, all forecasts     │
│ opens that day in Tab 1)            │ │ (2.3 GW at 2 days → 1.7 GW at 6 h)    │
└─────────────────────────────────────┘ └──────────────────────────────────────┘
```
- **Clicking a day in the daily chart** jumps to the Day-ahead view for that decision date, which links the two
  tabs together.
- **Each summary card has an ⓘ tooltip** explaining the metric in plain English (e.g. *"Bias: positive means the
  forecast expected more wind than turned up"*).

---

## 4. Components

| Component | Props | Notes |
|---|---|---|
| `Header` | `dataSource`, `loadedAt` | Title, scope line, `DataSourceBadge` |
| `Tabs` | `active`, `onChange` | Uses ARIA tab roles; works with the keyboard |
| `DecisionControls` | `date`, `cutoff`, `minDate`, `maxDate`, `onChange` | Native `<input type="date">` limited to Jan 1–31 + cutoff `<select>` |
| `ActualsToggle` | `checked`, `onChange` | Checkbox with a label |
| `KpiCard` | `label`, `value`, `unit`, `hint?`, `tone?` | `tone` = neutral / warning (e.g. positive bias) |
| `RecommendationCard` | `bufferMw`, `coverage`, `biasMw` | Turns the numbers into a plain sentence |
| `InfoTip` | `text` | Small ⓘ that shows a tooltip on hover and keyboard focus |
| `ForecastChart` | `points`, `showActuals` | Recharts `ComposedChart`: `Area` (P10–P90 band) + forecast `Line` + dashed actual `Line` |
| `ErrorByHourChart` | `byHour` | `ComposedChart`: MAE bars + P10–P90 band + bias line |
| `ErrorHistogram` | `histogram`, `p10`, `p50`, `p90` | `BarChart` + `ReferenceLine` markers; bars shaded differently for over- and under-forecast |
| `DailyErrorChart` | `daily`, `onSelectDay` | `BarChart` of MAE per day; clicking opens that day in Tab 1 |
| `HorizonChart` | `byHorizon` | `BarChart` of MAE per 6-hour lead-time bucket, using all forecasts (doesn't change with the cutoff). Shows accuracy improving closer to delivery; buckets with few hours (n < 100) shown faded |
| `ChartTooltip` | Recharts tooltip props | Shared style; shows UK time, forecast, actual, error, publish time, horizon |
| `LoadingState` / `ErrorState` / `EmptyState` | `message?`, `onRetry?` | Grey placeholder blocks while loading; retry button on errors |

---

## 5. Data layer

### Types (`api/types.ts`), matching the backend schemas (`backend/app/schemas.py`)
All numbers come rounded to 1 decimal place. Times are ISO-8601 UTC strings (`...Z`) and dates are `YYYY-MM-DD`.
```ts
export interface Meta {
  decision_date_min: string; decision_date_max: string;
  default_cutoff: string; timezone: string;
  publish_times_utc: string[]; data_source: "live" | "snapshot";
  fetched_at: string;            // when the data was fetched from Elexon (snapshot date if snapshot)
}
export interface DayAheadPoint {
  start_time: string; publish_time: string; horizon_h: number;
  forecast_mw: number; actual_mw: number | null; error_mw: number | null;
  band_low_mw: number | null; band_high_mw: number | null;
}
export interface DayAhead {
  decision_date: string; delivery_date: string; cutoff: string;
  forecast_publish_times: string[];
  summary: { forecast_energy_mwh: number;
             actual_energy_mwh: number | null;   // null unless every hour has an actual
             peak_forecast_mw: number | null; min_forecast_mw: number | null;
             mae_mw: number | null; bias_mw: number | null };
  points: DayAheadPoint[]; missing_forecast_hours: number; missing_actual_hours: number;
}
interface ErrorStats { mae_mw: number; bias_mw: number; p10_mw: number; p90_mw: number; n: number }
export interface Accuracy {
  cutoff: string;
  period: { delivery_from: string; delivery_to: string };
  summary: { n_hours: number; mae_mw: number | null; rmse_mw: number | null; bias_mw: number | null;
             nmae_pct: number | null; p10_mw: number | null; p50_mw: number | null;
             p90_mw: number | null; p90_abs_mw: number | null;
             max_over_mw: number | null; max_under_mw: number | null };
  recommendation: { coverage: number; buffer_mw: number | null };
  by_hour: (ErrorStats & { hour: number })[];
  by_horizon: (ErrorStats & { bucket: string; bucket_start_h: number })[];   // all forecasts, ignores cutoff
  daily: (ErrorStats & { delivery_date: string; forecast_energy_mwh: number; actual_energy_mwh: number })[];
  histogram: { bin_start_mw: number; bin_end_mw: number; count: number }[];
  missing_forecast_hours: number;   // e.g. 62 at cutoff 00:00
}
```
Error responses are `{ "detail": string }` for 422/503. FastAPI's own validation errors (e.g. a malformed
date) send `detail` as a list of `{ msg }`, so `ApiError` should handle both.

### Client (`api/client.ts`)
- `const BASE = import.meta.env.VITE_API_BASE_URL ?? ""`. Leaving it empty means the API is on the same address
  (`/api/...`), which works with the Vite proxy, Nginx and Vercel without changes.
- `getJson<T>(path)` raises an `ApiError(status, detail)` on non-2xx responses, so the UI can show the backend's
  422/503 message.

### Hooks (`api/hooks.ts`)
| Hook | Query key | Cache |
|---|---|---|
| `useMeta()` | `["meta"]` | Never goes stale |
| `useDayAhead(date, cutoff)` | `["day-ahead", date, cutoff]` | Kept 10 min; the old chart stays on screen while the new date loads (`placeholderData: keepPreviousData`) |
| `useAccuracy(cutoff)` | `["accuracy", cutoff]` | Kept 10 min |

January's data never changes, so turn off refetching when the window regains focus.

### State in the URL (`state/useUrlState.ts`)
`?tab=day-ahead&date=2026-01-31&cutoff=09:00`
- Links can be shared and pages bookmarked, which is useful in the pitch: *"send this view to a colleague"*.
- Bad values (date outside January, unknown cutoff) quietly fall back to the defaults.
- No router library is needed; a small hook uses `URLSearchParams` + `history.replaceState`.

---

## 6. Visual design

**Colours** (in `lib/colors.ts` and CSS variables)
| Use | Colour | Note |
|---|---|---|
| Forecast | blue `#2563eb` | Solid line, 2 px |
| Actual | dark slate `#0f172a` | Dashed line, so it still reads in black and white |
| Typical range (P10–P90) | light blue `#2563eb` at 15% opacity | Area behind the forecast |
| Over-forecast (risk of buying too little) | amber `#d97706` | Histogram bars, positive bias |
| Under-forecast | teal `#0d9488` | Histogram bars, negative bias |
| Page and cards | white cards on `#f8fafc`, 1 px `#e2e8f0` border, 12 px rounded corners | Clean, business look |

**Number formats** (`lib/format.ts`)
- Power: below 10,000 MW → `9,350 MW`; otherwise → `14.2 GW`
- Energy: `251 GWh` (the API sends MWh)
- Error values always show a sign: `+520 MW`, `−1.3 GW`
- Times always in **UK time** (`Europe/London`) with a "UK time" label on chart axes

**Layout**
- Main content is at most 1200 px wide
- Summary cards use CSS grid `repeat(auto-fit, minmax(180px, 1fr))`
- On Tab 2, charts sit two per row; on narrow screens they stack into one column
- Charts are 320 px tall (main forecast chart: 380 px)

**Accessibility**
- Every input has a `<label>`
- Tabs use ARIA roles and work with the keyboard
- The actual line is dashed, so meaning doesn't rely on colour alone
- Each chart has an `aria-label` summary (e.g. "Forecast vs actual, 24 hours, MAE 950 MW")

---

## 7. Screen states

| State | What the user sees |
|---|---|
| First load | Grey placeholder blocks shaped like the summary cards and chart |
| Changing date/cutoff | The old chart stays, slightly faded, with a small spinner, so nothing jumps |
| API error (503) | Red banner: "Couldn't load wind data. Retry" + the error detail |
| Validation error (422) | The error message under the controls |
| Missing actual hours | Gaps in the actual line + a note: "2 hours without actual data" |
| No forecast before the cutoff | Empty state: "No forecast was published before 02:00. Choose a later cutoff." |

---

## 8. Testing plan

| File | Checks |
|---|---|
| `format.test.ts` | MW/GW switch, GWh, signed values, UK time formatting |
| `DecisionControls.test.tsx` | Date is limited to Jan 1–31; changing the cutoff calls `onChange` |
| `DayAheadPage.test.tsx` | Fake `fetch`: shows the summary cards and "Using the forecast published …"; the actuals toggle hides the actual line and its card; the error state shows on a 503 |
| `AccuracyPage.test.tsx` | Shows the summary cards and the recommendation sentence with the correct MW value |

Run with: `npm test`. GitHub Actions runs `npm run lint`, `npm test` and `npm run build`.

---

## 9. Running and deploying

**Local** (backend running on port 8000)
```bash
cd frontend
npm install
npm run dev            # http://localhost:5173 (the Vite proxy forwards /api → :8000)
```

**Docker** (`frontend/Dockerfile`, two stages)
1. `node:24-alpine`: `npm ci && npm run build` → `dist/`
2. `nginx:alpine`: serves `dist/`
   - `nginx.conf` forwards `location /api/` → `http://backend:8000`
   - unknown paths fall back to `index.html` (`try_files $uri /index.html`)
   - static files are cached long-term

`docker compose up --build` → open http://localhost:8080

**Vercel**
- `vercel.json` at the repo root:
  - `buildCommand: "cd frontend && npm ci && npm run build"`
  - `outputDirectory: "frontend/dist"`
  - sends `/api/(.*)` → the Python function (see the backend plan)
- No env vars are needed: the frontend calls `/api` on the same address.

---

## 10. Task checklist (in order)

| # | Task | Time | Done |
|---|---|---|---|
| 1 | Create the Vite React-TS project, add dependencies, ESLint/Prettier, Vite proxy | 10 min | ☐ |
| 2 | `global.css`, colours, `format.ts` + tests | 15 min | ☐ |
| 3 | `api/types.ts`, `client.ts`, `hooks.ts`, `useUrlState` | 15 min | ☐ |
| 4 | Header, Tabs, DataSourceBadge, loading/error/empty states | 15 min | ☐ |
| 5 | Day-ahead view: controls, summary cards, `ForecastChart` with band + actuals toggle | 35 min | ☐ |
| 6 | Accuracy tab: summary cards, `RecommendationCard`, 4 charts, click-to-open-day | 40 min | ☐ |
| 7 | Responsive layout, ⓘ tooltips, final polish | 15 min | ☐ |
| 8 | Component tests | 15 min | ☐ |
| 9 | Dockerfile + nginx.conf; test with `docker compose` | 10 min | ☐ |
| | **Total** | **~2 h 50 min** | |

---

## 11. Optional extras (only if time allows)

- **Forecast history view:** for one delivery day, overlay every forecast published in the previous 48 h to show
  how the forecast changed (needs one new backend endpoint).
- **CSV download** of the current day's data or the accuracy table.
- **Dark mode** using `prefers-color-scheme` and the same CSS variables.

---

## 12. How the UI supports the video demo

**Part 1 – client pitch (≈5 min)**
1. Open the Day-ahead view on Jan 31 with actuals **off**: *"This is exactly what your trader sees at 09:00."*
2. Point to the shaded band: *"Not just one number: the realistic range, based on how wrong forecasts have been."*
3. Turn actuals **on**: *"And here's what actually happened."*
4. Switch to Forecast accuracy and show the recommendation card: *"Plan for 1.8 GW less wind than forecast to be
   covered 90% of the time."*
5. Click a bad day in the daily chart to open it, then change the cutoff to show how a later forecast improves
   accuracy.

**Part 2 – tech lead** (frontend part): folder layout, the types matching the backend, the TanStack Query
hooks, state kept in the URL, chart components, tests and CI.
