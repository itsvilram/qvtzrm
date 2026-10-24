"""Small, realistic sample data shared by the tests."""

from datetime import UTC, datetime

import pandas as pd

from app.snapshot import Snapshot


def sample_actuals() -> pd.DataFrame:
    """FUELHH-shaped half-hourly actuals for 2026-01-02 00:00–01:30 UTC."""
    return pd.DataFrame(
        {
            "start_time": pd.to_datetime(
                [
                    "2026-01-02T00:00Z",
                    "2026-01-02T00:30Z",
                    "2026-01-02T01:00Z",
                    "2026-01-02T01:30Z",
                ],
                utc=True,
            ),
            "generation_mw": [9000.0, 9200.0, 9400.0, 9600.0],
        }
    )


def sample_forecasts() -> pd.DataFrame:
    """WINDFOR-shaped forecasts for 2026-01-02 00:00 and 01:00 from two publishes on 1 Jan."""
    return pd.DataFrame(
        {
            "publish_time": pd.to_datetime(
                [
                    "2026-01-01T04:30Z",
                    "2026-01-01T04:30Z",
                    "2026-01-01T07:30Z",
                    "2026-01-01T07:30Z",
                ],
                utc=True,
            ),
            "start_time": pd.to_datetime(
                [
                    "2026-01-02T00:00Z",
                    "2026-01-02T01:00Z",
                    "2026-01-02T00:00Z",
                    "2026-01-02T01:00Z",
                ],
                utc=True,
            ),
            "generation_mw": [9900.0, 10100.0, 9600.0, 9800.0],
        }
    )


SNAPSHOT_FETCHED_AT = datetime(2026, 10, 24, 12, 0, tzinfo=UTC)


def sample_snapshot() -> Snapshot:
    return Snapshot(
        actuals=sample_actuals(), forecasts=sample_forecasts(), fetched_at=SNAPSHOT_FETCHED_AT
    )
