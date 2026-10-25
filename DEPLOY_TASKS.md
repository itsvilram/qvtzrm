# Deployment & Submission Tasks

The last phase: put the app online, document it, and prepare the submission. Same process as the backend and
frontend: one task at a time → checks → review → ✅, commit, push.

**Status key:** ⬜ Not started · 🔄 In progress · 👀 In review · ✅ Done

| # | Task | Who | Time | Status |
|---|---|---|---|---|
| 1 | [Vercel configuration in the repo](#task-1--vercel-configuration-in-the-repo) | Claude | 30 min | ✅ |
| 2 | [Deploy on Vercel and check the live site](#task-2--deploy-on-vercel-and-check-the-live-site) | **You** + Claude | 15 min | 👀 |
| 3 | [README](#task-3--readme) | Claude | 30 min | ⬜ |
| 4 | [Automated checks on GitHub (CI)](#task-4--automated-checks-on-github-ci) | Claude | 20 min | ⬜ |
| 5 | [Video script](#task-5--video-script) | Claude writes, **you** record | 30 min + recording | ⬜ |
| 6 | [Submission](#task-6--submission) | **You** | 15 min | ⬜ |

---

## Task 1 – Vercel configuration in the repo
**Status:** ✅ Done · **Who:** Claude

Vercel runs the FastAPI backend as one serverless function and serves the built React app from its CDN, using
FastAPI's `app.frontend()` (supported by FastAPI 0.162 and Vercel's FastAPI preset).

**Files**
- `main.py` (repo root): Vercel's entry point. It loads the backend app, defaults `DATA_SOURCE` to `snapshot`
  and registers `frontend/dist` as the frontend
- `requirements.txt` (repo root): the backend's runtime packages, same pins (no uvicorn: Vercel runs the app itself)
- `vercel.json`: build command for the frontend; keeps `node_modules`, sources, tests and docs out of the function
- `backend/tests/test_requirements.py`: fails if the two requirements files ever disagree

**Done when**
- [x] Locally, `uvicorn main:app` from the repo root serves the app at `/` and the API at `/api/*` from one
      process (the same way Vercel will) → `/`, built files, favicon, deep links, `/api/*`, `/api/docs` ✓
- [x] The end-to-end demo script passes against it (13/13), with `data_source: snapshot` ✓
- [x] Estimated function size well under Vercel's 500 MB limit → **~173 MB** (172 MB packages measured on Linux
      in Docker, + 1 MB app code, data and built frontend)
- [x] Backend and frontend checks still pass → backend **78 tests** (+1: requirements match), ruff clean;
      frontend build ✓
- [x] Extra: an empty `DATA_SOURCE` set in the Vercel dashboard falls back to `snapshot` instead of crashing

## Task 2 – Deploy on Vercel and check the live site
**Status:** ⬜ · **Who:** you (account + import), Claude (checks)

1. Sign up at vercel.com with **"Continue with GitHub"** (account `itsvilram`, personal email only)
2. **Add New → Project** → import `qvtzrm` (give access to that repo only) → keep the detected settings → **Deploy**
3. Send Claude the production URL (e.g. `https://qvtzrm.vercel.app`)

**Live at: https://qvtzrm.vercel.app** (Vercel detected three apps; the root `app` (FastAPI, `/`) was imported as a
single project.)

**Done when**
- [x] The production URL opens in an **incognito** window (no login) → checked with a fresh browser (no cookies)
- [x] The end-to-end demo script passes against the production URL → **13/13**; axe 0 violations; 28 Jan click
      works; no failed requests or console errors; `data_source: snapshot`; 0.3–0.5 s per request
- [x] Only the production URL is used from now on (preview URLs may need a Vercel login)
- [ ] Follow-up in `vercel.json`: cache built JS/CSS for a year (Vercel served them with `max-age=0`) and add the
      same `nosniff` / `Referrer-Policy` headers as Nginx. Check again after the redeploy

## Task 3 – README
**Status:** ⬜ · **Who:** Claude

What the brief requires: files and directories, how to start the application, the Vercel link, and a note that
AI tools were used. Also: what the app does (with screenshots), architecture, the forecast-selection rule,
headline results, assumptions and limitations, how it was tested.

## Task 4 – Automated checks on GitHub (CI)
**Status:** ⬜ · **Who:** Claude

GitHub Actions on every push: backend (`ruff`, `pytest`) and frontend (`lint`, `format:check`, `test`, `build`).
A green badge in the README.

## Task 5 – Video script
**Status:** ⬜ · **Who:** Claude writes, you record

`docs/VIDEO_SCRIPT.md`, timed to stay under 10 minutes:
- **Part 1, client pitch (≤ 5 min):** the problem, a live demo following the demo script, the recommendation
- **Part 2, tech lead (≤ 5 min):** architecture, the forecast-selection logic, analysis choices, code tour,
  testing and development practices

## Task 6 – Submission
**Status:** ⬜ · **Who:** you

- [ ] Unlisted YouTube video uploaded
- [ ] Submission form filled in: https://forms.cloud.microsoft/r/Ljmf1aWESK
- [ ] Every submitted link opened in an **incognito** window: video, GitHub repo, Vercel app

---

## Review log

| Task | Date | Result | Notes |
|---|---|---|---|
| 1 – Vercel configuration | 2026-10-25 | ✅ Approved | `main.py` entry (snapshot by default, frontend via `app.frontend`), root `requirements.txt` (pins checked by a test), `vercel.json`; local single-process run passes the demo walk-through 13/13; function ~173 MB of 500 MB |
