from datetime import date

import numpy as np
import pandas as pd
import pytest

from app import metrics


def joined(rows):
    """Build a joined frame from (target ISO, forecast MW, actual MW or None, horizon h) tuples."""
    start, forecast, actual, horizon = zip(*rows, strict=True)
    df = pd.DataFrame(
        {
            "start_time": pd.to_datetime(list(start), utc=True),
            "forecast_mw": list(forecast),
            "actual_mw": [np.nan if a is None else a for a in actual],
            "horizon_h": list(horizon),
        }
    )
    df["error_mw"] = df["forecast_mw"] - df["actual_mw"]
    return df


# Errors -2, 0, +2 against an actual of 10 MW each.
SIMPLE = joined(
    [
        ("2026-01-02T00:00Z", 8.0, 10.0, 16.5),
        ("2026-01-02T01:00Z", 10.0, 10.0, 17.5),
        ("2026-01-02T02:00Z", 12.0, 10.0, 18.5),
    ]
)


def test_join_actuals_keeps_hours_without_actual_and_uses_sign_convention():
    selected = pd.DataFrame(
        {
            "start_time": pd.to_datetime(["2026-01-02T00:00Z", "2026-01-02T01:00Z"], utc=True),
            "decision_date": [date(2026, 1, 1)] * 2,
            "publish_time": pd.to_datetime(["2026-01-01T07:30Z"] * 2, utc=True),
            "horizon_h": [16.5, 17.5],
            "forecast_mw": [10.0, 20.0],
        }
    )
    actuals = pd.DataFrame(
        {"start_time": pd.to_datetime(["2026-01-02T00:00Z"], utc=True), "actual_mw": [8.0]}
    )

    result = metrics.join_actuals(selected, actuals)

    assert list(result.columns) == metrics.JOINED_COLUMNS
    assert result.loc[0, "error_mw"] == 2.0  # forecast 10, actual 8 → over-forecast by 2
    assert np.isnan(result.loc[1, "actual_mw"]) and np.isnan(result.loc[1, "error_mw"])


def test_summary_known_values():
    result = metrics.summary(SIMPLE)

    assert result["n_hours"] == 3
    assert result["mae_mw"] == pytest.approx(4 / 3)
    assert result["rmse_mw"] == pytest.approx(np.sqrt(8 / 3))
    assert result["bias_mw"] == pytest.approx(0.0)
    assert result["nmae_pct"] == pytest.approx(100 * (4 / 3) / 10)
    assert result["max_over_mw"] == 2.0
    assert result["max_under_mw"] == -2.0


def test_summary_percentiles_match_numpy():
    errors = [-2.0, 0.0, 2.0]
    result = metrics.summary(SIMPLE)

    assert result["p10_mw"] == pytest.approx(np.percentile(errors, 10))
    assert result["p50_mw"] == pytest.approx(np.percentile(errors, 50))
    assert result["p90_mw"] == pytest.approx(np.percentile(errors, 90))
    assert result["p90_abs_mw"] == pytest.approx(np.percentile(np.abs(errors), 90))


def test_summary_skips_hours_without_actual():
    with_gap = pd.concat([SIMPLE, joined([("2026-01-02T03:00Z", 99.0, None, 19.5)])])

    assert metrics.summary(with_gap) == metrics.summary(SIMPLE)


def test_summary_of_empty_input_does_not_crash():
    result = metrics.summary(SIMPLE.iloc[0:0])

    assert result["n_hours"] == 0
    assert all(result[key] is None for key in metrics.SUMMARY_KEYS)


def test_recommendation_is_p90_of_error():
    result = metrics.recommendation(SIMPLE)

    assert result == {"coverage": 0.9, "buffer_mw": pytest.approx(np.percentile([-2, 0, 2], 90))}
    assert metrics.recommendation(SIMPLE.iloc[0:0])["buffer_mw"] is None


def test_by_hour_groups_by_uk_hour():
    df = joined(
        [
            ("2026-01-02T00:00Z", 12.0, 10.0, 16.5),
            ("2026-01-03T00:00Z", 14.0, 10.0, 16.5),
            ("2026-07-02T00:00Z", 10.0, 10.0, 16.5),  # 01:00 UK time (BST)
        ]
    )

    result = metrics.by_hour(df)

    assert list(result.columns) == metrics.BY_HOUR_COLUMNS
    assert result["hour"].tolist() == [0, 1]
    assert result["n"].tolist() == [2, 1]
    assert result["mae_mw"].tolist() == [3.0, 0.0]


def raw_forecasts(rows):
    """Build a WINDFOR-shaped frame from (publish ISO, target ISO, MW) tuples."""
    publish, start, mw = zip(*rows, strict=True)
    return pd.DataFrame(
        {
            "publish_time": pd.to_datetime(list(publish), utc=True),
            "start_time": pd.to_datetime(list(start), utc=True),
            "generation_mw": list(mw),
        }
    )


HOURLY_ACTUALS = pd.DataFrame(
    {
        "start_time": pd.to_datetime(
            ["2026-01-01T12:00Z", "2026-01-03T00:00Z", "2026-02-02T00:00Z"], utc=True
        ),
        "actual_mw": [100.0, 100.0, 100.0],
    }
)


def test_by_horizon_uses_every_forecast_vintage():
    result = metrics.by_horizon(
        raw_forecasts(
            [
                ("2026-01-01T07:30Z", "2026-01-03T00:00Z", 140.0),  # 40.5 h ahead, error +40
                ("2026-01-01T22:30Z", "2026-01-03T00:00Z", 120.0),  # 25.5 h ahead, error +20
                ("2026-01-02T22:30Z", "2026-01-03T00:00Z", 110.0),  #  1.5 h ahead, error +10
            ]
        ),
        HOURLY_ACTUALS,
    )

    assert list(result.columns) == metrics.BY_HORIZON_COLUMNS
    assert result["bucket"].tolist() == ["0-6h", "24-30h", "36-42h"]
    assert result["mae_mw"].tolist() == [10.0, 20.0, 40.0]
    assert result["n"].tolist() == [1, 1, 1]


def test_by_horizon_skips_late_forecasts_missing_actuals_and_out_of_range_hours():
    result = metrics.by_horizon(
        raw_forecasts(
            [
                ("2026-01-03T00:30Z", "2026-01-03T00:00Z", 999.0),  # published after the hour began
                ("2026-01-01T07:30Z", "2026-01-03T05:00Z", 999.0),  # no actual for that hour
                ("2025-12-31T07:30Z", "2026-01-01T12:00Z", 999.0),  # 1 Jan: before delivery range
                ("2026-01-31T07:30Z", "2026-02-02T00:00Z", 999.0),  # 2 Feb: after delivery range
                ("2026-01-02T07:30Z", "2026-01-03T00:00Z", 105.0),  # the only one that counts
            ]
        ),
        HOURLY_ACTUALS,
    )

    assert result["bucket"].tolist() == ["12-18h"]
    assert result["mae_mw"].tolist() == [5.0]


def test_daily_energy_and_error():
    hours = pd.date_range("2026-01-02T00:00Z", periods=24, freq="h")
    df = joined([(t.isoformat(), 1000.0, 900.0, 16.5) for t in hours])

    result = metrics.daily(df)

    assert list(result.columns) == metrics.DAILY_COLUMNS
    assert result["delivery_date"].tolist() == [date(2026, 1, 2)]
    assert result["forecast_energy_mwh"].tolist() == [24_000.0]
    assert result["actual_energy_mwh"].tolist() == [21_600.0]
    assert result["mae_mw"].tolist() == [100.0]
    assert result["bias_mw"].tolist() == [100.0]


def test_histogram_bins_are_continuous_and_counts_add_up():
    df = joined(
        [
            ("2026-01-02T00:00Z", 0.0, 600.0, 16.5),  # error -600
            ("2026-01-02T01:00Z", 0.0, 100.0, 16.5),  # error -100
            ("2026-01-02T02:00Z", 100.0, 0.0, 16.5),  # error  100
            ("2026-01-02T03:00Z", 1200.0, 0.0, 16.5),  # error 1200
        ]
    )

    result = metrics.histogram(df, bin_mw=500)

    assert list(result.columns) == metrics.HISTOGRAM_COLUMNS
    assert result["bin_start_mw"].tolist() == [-1000, -500, 0, 500, 1000]
    assert result["count"].tolist() == [1, 1, 1, 0, 1]
    assert result["count"].sum() == len(df)


def test_histogram_of_empty_input():
    result = metrics.histogram(SIMPLE.iloc[0:0])

    assert result.empty
    assert list(result.columns) == metrics.HISTOGRAM_COLUMNS


def test_uncertainty_band_uses_hourly_percentiles():
    points = pd.DataFrame(
        {"start_time": pd.to_datetime(["2026-01-02T00:00Z"], utc=True), "forecast_mw": [1000.0]}
    )
    hour_stats = pd.DataFrame({"hour": [0], "p10_mw": [-200.0], "p90_mw": [300.0]})

    result = metrics.add_uncertainty_band(points, hour_stats)

    assert result.loc[0, "band_low_mw"] == 700.0  # forecast − P90
    assert result.loc[0, "band_high_mw"] == 1200.0  # forecast − P10
