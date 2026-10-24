from datetime import date, time

import pandas as pd

from app.forecasts import SELECTED_COLUMNS, decision_cutoff_utc, select_decision_forecasts

NINE = time(9, 0)


def forecasts(rows):
    """Build a WINDFOR-shaped frame from (publish ISO, target ISO, MW) tuples."""
    publish, start, mw = zip(*rows, strict=True) if rows else ((), (), ())
    return pd.DataFrame(
        {
            "publish_time": pd.to_datetime(list(publish), utc=True),
            "start_time": pd.to_datetime(list(start), utc=True),
            "generation_mw": list(mw),
        }
    )


def select(rows, cutoff=NINE):
    return select_decision_forecasts(
        forecasts(rows), cutoff, delivery_from=date(2026, 1, 2), delivery_to=date(2026, 2, 1)
    )


def test_picks_latest_forecast_before_cutoff():
    result = select(
        [
            ("2026-01-01T04:30Z", "2026-01-02T00:00Z", 100.0),
            ("2026-01-01T07:30Z", "2026-01-02T00:00Z", 200.0),
            ("2026-01-01T09:30Z", "2026-01-02T00:00Z", 300.0),  # after the 09:00 cutoff
        ]
    )

    assert list(result.columns) == SELECTED_COLUMNS
    assert len(result) == 1
    assert result.loc[0, "publish_time"] == pd.Timestamp("2026-01-01T07:30Z")
    assert result.loc[0, "forecast_mw"] == 200.0


def test_forecast_published_after_cutoff_is_never_used():
    result = select([("2026-01-01T09:30Z", "2026-01-02T00:00Z", 300.0)])

    assert result.empty


def test_forecast_published_exactly_at_cutoff_counts():
    result = select([("2026-01-01T09:00Z", "2026-01-02T00:00Z", 250.0)])

    assert result["forecast_mw"].tolist() == [250.0]


def test_late_publish_is_handled():
    # The 11:30 forecast was once published late, at 12:25.
    result = select(
        [
            ("2026-01-01T09:30Z", "2026-01-02T00:00Z", 100.0),
            ("2026-01-01T12:25Z", "2026-01-02T00:00Z", 200.0),
        ],
        cutoff=time(13, 0),
    )

    assert result.loc[0, "publish_time"] == pd.Timestamp("2026-01-01T12:25Z")


def test_hour_without_eligible_forecast_is_left_out():
    result = select(
        [
            ("2026-01-01T07:30Z", "2026-01-02T00:00Z", 100.0),
            ("2026-01-01T09:30Z", "2026-01-02T01:00Z", 200.0),  # only forecast is too late
        ]
    )

    assert result["start_time"].tolist() == [pd.Timestamp("2026-01-02T00:00Z")]


def test_each_delivery_day_uses_its_own_cutoff():
    # Published 2 Jan 07:30: too late for 2 Jan delivery (cutoff 1 Jan 09:00),
    # but in time for 3 Jan delivery (cutoff 2 Jan 09:00).
    result = select(
        [
            ("2026-01-02T07:30Z", "2026-01-02T12:00Z", 100.0),
            ("2026-01-02T07:30Z", "2026-01-03T00:00Z", 200.0),
        ]
    )

    assert result["start_time"].tolist() == [pd.Timestamp("2026-01-03T00:00Z")]


def test_horizon_and_decision_date():
    result = select(
        [
            ("2026-01-01T07:30Z", "2026-01-02T00:00Z", 100.0),
            ("2026-01-01T07:30Z", "2026-01-02T23:00Z", 200.0),
        ]
    )

    assert result["horizon_h"].tolist() == [16.5, 39.5]
    assert result["decision_date"].tolist() == [date(2026, 1, 1), date(2026, 1, 1)]


def test_targets_outside_delivery_range_are_dropped():
    result = select(
        [
            ("2025-12-31T07:30Z", "2026-01-01T12:00Z", 100.0),  # 1 Jan: before the range
            ("2026-01-01T07:30Z", "2026-01-02T12:00Z", 200.0),
            ("2026-01-31T07:30Z", "2026-02-02T00:00Z", 300.0),  # 2 Feb: after the range
        ]
    )

    assert result["forecast_mw"].tolist() == [200.0]


def test_output_sorted_by_target_hour():
    result = select(
        [
            ("2026-01-01T07:30Z", "2026-01-02T05:00Z", 5.0),
            ("2026-01-01T07:30Z", "2026-01-02T01:00Z", 1.0),
            ("2026-01-01T04:30Z", "2026-01-02T03:00Z", 3.0),
        ]
    )

    assert result["forecast_mw"].tolist() == [1.0, 3.0, 5.0]


def test_empty_input_gives_empty_frame_with_columns():
    result = select([])

    assert result.empty
    assert list(result.columns) == SELECTED_COLUMNS


def test_decision_cutoff_is_uk_time():
    # January is GMT: 09:00 UK = 09:00 UTC.
    assert decision_cutoff_utc(date(2026, 1, 2), NINE) == pd.Timestamp("2026-01-01T09:00Z")
    # July is BST (UTC+1): 09:00 UK = 08:00 UTC.
    assert decision_cutoff_utc(date(2026, 7, 2), NINE) == pd.Timestamp("2026-07-01T08:00Z")
