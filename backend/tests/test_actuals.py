import pandas as pd

from app.actuals import HOURLY_ACTUALS_COLUMNS, to_hourly


def half_hourly(rows):
    """Build a FUELHH-shaped frame from (ISO time, MW) pairs."""
    times, values = zip(*rows, strict=True) if rows else ((), ())
    return pd.DataFrame(
        {"start_time": pd.to_datetime(list(times), utc=True), "generation_mw": list(values)}
    )


def test_averages_the_two_half_hours():
    df = to_hourly(half_hourly([("2026-01-02T00:00Z", 100.0), ("2026-01-02T00:30Z", 200.0)]))

    assert list(df.columns) == HOURLY_ACTUALS_COLUMNS
    assert df["start_time"].tolist() == [pd.Timestamp("2026-01-02T00:00Z")]
    assert df["actual_mw"].tolist() == [150.0]


def test_output_is_sorted_with_one_row_per_hour():
    df = to_hourly(
        half_hourly(
            [
                ("2026-01-02T01:30Z", 40.0),
                ("2026-01-02T00:00Z", 10.0),
                ("2026-01-02T01:00Z", 30.0),
                ("2026-01-02T00:30Z", 20.0),
            ]
        )
    )

    assert df["start_time"].tolist() == [
        pd.Timestamp("2026-01-02T00:00Z"),
        pd.Timestamp("2026-01-02T01:00Z"),
    ]
    assert df["actual_mw"].tolist() == [15.0, 35.0]
    assert df["start_time"].is_unique


def test_hour_missing_a_half_hour_is_dropped():
    df = to_hourly(
        half_hourly(
            [
                ("2026-01-02T00:00Z", 100.0),
                ("2026-01-02T00:30Z", 200.0),
                ("2026-01-02T01:00Z", 300.0),  # 01:30 missing
            ]
        )
    )

    assert df["start_time"].tolist() == [pd.Timestamp("2026-01-02T00:00Z")]


def test_duplicate_half_hour_keeps_last_value():
    df = to_hourly(
        half_hourly(
            [
                ("2026-01-02T00:00Z", 999.0),
                ("2026-01-02T00:00Z", 100.0),
                ("2026-01-02T00:30Z", 200.0),
            ]
        )
    )

    assert df["actual_mw"].tolist() == [150.0]


def test_empty_input_gives_empty_frame_with_columns():
    df = to_hourly(half_hourly([]))

    assert df.empty
    assert list(df.columns) == HOURLY_ACTUALS_COLUMNS
