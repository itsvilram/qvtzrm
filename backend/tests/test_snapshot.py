from datetime import UTC, datetime

import pandas as pd
from pandas.testing import assert_frame_equal

from app.elexon import ACTUALS_COLUMNS, FORECASTS_COLUMNS
from app.snapshot import load_snapshot, save_snapshot

FETCHED_AT = datetime(2026, 10, 24, 12, 0, tzinfo=UTC)


def make_actuals():
    return pd.DataFrame(
        {
            "start_time": pd.to_datetime(
                ["2026-01-02T00:00:00Z", "2026-01-02T00:30:00Z"], utc=True
            ),
            "generation_mw": [8000.0, 8100.0],
        }
    )


def make_forecasts():
    return pd.DataFrame(
        {
            "publish_time": pd.to_datetime(["2026-01-01T07:30:00Z"] * 2, utc=True),
            "start_time": pd.to_datetime(
                ["2026-01-02T00:00:00Z", "2026-01-02T01:00:00Z"], utc=True
            ),
            "generation_mw": [9000.0, 9100.0],
        }
    )


def test_round_trip_returns_identical_frames(tmp_path):
    actuals, forecasts = make_actuals(), make_forecasts()

    save_snapshot(actuals, forecasts, FETCHED_AT, data_dir=tmp_path)
    snapshot = load_snapshot(tmp_path)

    assert_frame_equal(snapshot.actuals, actuals)
    assert_frame_equal(snapshot.forecasts, forecasts)
    assert snapshot.fetched_at == FETCHED_AT


def test_round_trip_of_empty_frames_keeps_columns(tmp_path):
    actuals = make_actuals().iloc[0:0]
    forecasts = make_forecasts().iloc[0:0]

    save_snapshot(actuals, forecasts, FETCHED_AT, data_dir=tmp_path)
    snapshot = load_snapshot(tmp_path)

    assert snapshot.actuals.empty and list(snapshot.actuals.columns) == ACTUALS_COLUMNS
    assert snapshot.forecasts.empty and list(snapshot.forecasts.columns) == FORECASTS_COLUMNS


def test_same_data_gives_byte_identical_files(tmp_path):
    first = save_snapshot(make_actuals(), make_forecasts(), FETCHED_AT, data_dir=tmp_path / "a")
    second = save_snapshot(make_actuals(), make_forecasts(), FETCHED_AT, data_dir=tmp_path / "b")

    for a, b in zip(first, second, strict=True):
        assert a.read_bytes() == b.read_bytes()
