"""Independent spot check: work out a few API values by hand from raw Elexon JSON.

Run from ``backend/`` with ``python -m scripts.spot_check``. It reads Elexon directly with
plain Python (none of the app's data code, no pandas) and compares the result with what
``/api/day-ahead`` returns for the same hours. Exits with code 1 on any mismatch.
"""

import sys
from datetime import date, timedelta

import httpx
from fastapi.testclient import TestClient

from app.main import app

ELEXON = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
CUTOFF = "09:00"  # January is GMT, so 09:00 UK time is 09:00 UTC

# (decision date, target hour): first hour of a day, midday, last hour of the worst day.
CASES = [
    (date(2026, 1, 1), "2026-01-02T00:00:00Z"),
    (date(2026, 1, 15), "2026-01-16T12:00:00Z"),
    (date(2026, 1, 27), "2026-01-28T23:00:00Z"),
]


def by_hand(http: httpx.Client, decision: date, target: str) -> dict:
    deadline = f"{decision}T{CUTOFF}:00Z"
    forecasts = http.get(
        f"{ELEXON}/WINDFOR/stream",
        params={
            "publishDateTimeFrom": f"{decision - timedelta(days=1)}T00:00:00Z",
            "publishDateTimeTo": deadline,
        },
    ).json()
    # Same-format ISO strings compare correctly as text.
    candidates = [f for f in forecasts if f["startTime"] == target and f["publishTime"] <= deadline]
    latest = max(candidates, key=lambda f: f["publishTime"])

    delivery_day = target[:10]
    actuals = http.get(
        f"{ELEXON}/FUELHH/stream",
        params={
            "settlementDateFrom": delivery_day,
            "settlementDateTo": delivery_day,
            "fuelType": "WIND",
        },
    ).json()
    half_hours = {target, target[:14] + "30:00Z"}
    values = [a["generation"] for a in actuals if a["startTime"] in half_hours]
    actual = sum(values) / len(values)

    return {
        "publish_time": latest["publishTime"],
        "forecast_mw": float(latest["generation"]),
        "actual_mw": actual,
        "error_mw": latest["generation"] - actual,
    }


def from_api(api: TestClient, decision: date, target: str) -> dict:
    body = api.get(
        "/api/day-ahead", params={"decision_date": str(decision), "cutoff": CUTOFF}
    ).json()
    point = next(p for p in body["points"] if p["start_time"] == target)
    return {key: point[key] for key in ("publish_time", "forecast_mw", "actual_mw", "error_mw")}


def main() -> int:
    failures = 0
    with httpx.Client(timeout=60) as http, TestClient(app) as api:
        for decision, target in CASES:
            expected, got = by_hand(http, decision, target), from_api(api, decision, target)
            ok = expected == got
            failures += not ok
            print(f"{'OK  ' if ok else 'FAIL'} decision {decision}, target {target}")
            for key in expected:
                mark = "" if expected[key] == got[key] else "   <-- differs"
                print(f"     {key:<13} by hand {expected[key]!s:<22} API {got[key]!s:<22}{mark}")
    print(f"\n{len(CASES) - failures}/{len(CASES)} spot checks match")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
