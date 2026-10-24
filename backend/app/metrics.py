"""Forecast error metrics.

Sign convention everywhere: ``error = forecast − actual`` (MW). A positive error means wind was
over-forecast: less wind turned up than expected, so the trader risks buying too little power.

All functions are pure (DataFrames in, numbers or DataFrames out) and skip hours that have no
actual value yet.
"""

from datetime import date, timedelta

import numpy as np
import pandas as pd

from app import config
from app.forecasts import SELECTED_COLUMNS

JOINED_COLUMNS = [*SELECTED_COLUMNS, "actual_mw", "error_mw"]

SUMMARY_KEYS = [
    "mae_mw",
    "rmse_mw",
    "bias_mw",
    "nmae_pct",
    "p10_mw",
    "p50_mw",
    "p90_mw",
    "p90_abs_mw",
    "max_over_mw",
    "max_under_mw",
]
STATS_COLUMNS = ["mae_mw", "bias_mw", "p10_mw", "p90_mw", "n"]
BY_HOUR_COLUMNS = ["hour", *STATS_COLUMNS]
BY_HORIZON_COLUMNS = ["bucket", "bucket_start_h", *STATS_COLUMNS]
DAILY_COLUMNS = ["delivery_date", *STATS_COLUMNS, "forecast_energy_mwh", "actual_energy_mwh"]
HISTOGRAM_COLUMNS = ["bin_start_mw", "bin_end_mw", "count"]


def join_actuals(selected: pd.DataFrame, actuals_hourly: pd.DataFrame) -> pd.DataFrame:
    """Attach the hourly actual to each selected forecast and compute ``error_mw``.

    Forecast hours without an actual are kept (``actual_mw`` and ``error_mw`` are NaN), so the
    day-ahead view can still show the forecast; the metrics below skip them.
    """
    joined = selected.merge(actuals_hourly, on="start_time", how="left")
    joined["error_mw"] = joined["forecast_mw"] - joined["actual_mw"]
    return joined[JOINED_COLUMNS]


def summary(df: pd.DataFrame) -> dict[str, float | int | None]:
    """Headline accuracy figures over all hours that have an actual value."""
    scored = _scored(df)
    errors = scored["error_mw"]
    if errors.empty:
        return {"n_hours": 0, **dict.fromkeys(SUMMARY_KEYS, None)}

    mae = errors.abs().mean()
    values = {
        "mae_mw": mae,
        "rmse_mw": np.sqrt((errors**2).mean()),
        "bias_mw": errors.mean(),
        # Relative to mean output rather than per hour, so low-wind hours can't blow it up.
        "nmae_pct": 100 * mae / scored["actual_mw"].mean(),
        "p10_mw": errors.quantile(0.1),
        "p50_mw": errors.quantile(0.5),
        "p90_mw": errors.quantile(0.9),
        "p90_abs_mw": errors.abs().quantile(0.9),
        "max_over_mw": errors.max(),
        "max_under_mw": errors.min(),
    }
    return {"n_hours": len(errors), **{key: float(values[key]) for key in SUMMARY_KEYS}}


def recommendation(df: pd.DataFrame, coverage: float = 0.9) -> dict[str, float | None]:
    """Safety margin for planning: plan for ``buffer_mw`` less wind than the forecast.

    It is the ``coverage`` quantile of the error, so in that share of past hours the actual was
    no more than ``buffer_mw`` below the forecast.
    """
    errors = _scored(df)["error_mw"]
    buffer = float(errors.quantile(coverage)) if not errors.empty else None
    return {"coverage": coverage, "buffer_mw": buffer}


def by_hour(df: pd.DataFrame) -> pd.DataFrame:
    """Error statistics for each hour of the day (UK time, 0–23)."""
    scored = _scored(df)
    hour = scored["start_time"].dt.tz_convert(config.TIMEZONE).dt.hour.rename("hour")
    return _error_stats(scored, hour)[BY_HOUR_COLUMNS]


def by_horizon(
    forecasts: pd.DataFrame,
    actuals_hourly: pd.DataFrame,
    bucket_h: int = 6,
    delivery_from: date = config.DELIVERY_DATE_MIN,
    delivery_to: date = config.DELIVERY_DATE_MAX,
) -> pd.DataFrame:
    """Error statistics by how far ahead the forecast was made, in ``bucket_h``-hour buckets.

    Uses *every* forecast published before each target hour, not just the one selected at the
    decision cutoff, so it shows how accuracy improves as delivery gets closer. (With one fixed
    cutoff, each hour of day always has the same lead time, so the selected forecasts alone
    would only repeat ``by_hour``.) It therefore does not depend on the cutoff.
    """
    window_start = config.london_midnight_utc(delivery_from)
    window_end = config.london_midnight_utc(delivery_to + timedelta(days=1))
    df = forecasts.merge(actuals_hourly, on="start_time")  # only hours with an actual
    df = df[(df["start_time"] >= window_start) & (df["start_time"] < window_end)]
    df = df.assign(
        horizon_h=(df["start_time"] - df["publish_time"]).dt.total_seconds() / 3600,
        error_mw=df["generation_mw"] - df["actual_mw"],
    )
    scored = df[df["horizon_h"] > 0]  # forecasts for hours already under way don't count

    start = (scored["horizon_h"] // bucket_h * bucket_h).astype(int).rename("bucket_start_h")
    stats = _error_stats(scored, start)
    stats["bucket"] = [f"{s}-{s + bucket_h}h" for s in stats["bucket_start_h"]]
    return stats[BY_HORIZON_COLUMNS]


def daily(df: pd.DataFrame) -> pd.DataFrame:
    """Error statistics and energy totals for each delivery day (UK date)."""
    scored = _scored(df)
    day = scored["start_time"].dt.tz_convert(config.TIMEZONE).dt.date.rename("delivery_date")
    stats = _error_stats(scored, day)
    # Each row is one hour, so summing MW gives MWh.
    energy = scored.groupby(day)[["forecast_mw", "actual_mw"]].sum().reset_index(drop=True)
    stats["forecast_energy_mwh"] = energy["forecast_mw"]
    stats["actual_energy_mwh"] = energy["actual_mw"]
    return stats[DAILY_COLUMNS]


def histogram(df: pd.DataFrame, bin_mw: int = 500) -> pd.DataFrame:
    """Count of errors in ``bin_mw``-wide bins aligned to multiples of ``bin_mw``.

    Bins are ``[start, end)`` and run continuously from the lowest to the highest error,
    including empty bins, so the chart has no gaps.
    """
    errors = _scored(df)["error_mw"]
    if errors.empty:
        return pd.DataFrame(columns=HISTOGRAM_COLUMNS)

    first, last = np.floor(errors.min() / bin_mw), np.floor(errors.max() / bin_mw)
    edges = np.arange(first, last + 2) * bin_mw
    counts, _ = np.histogram(errors, bins=edges)
    return pd.DataFrame({"bin_start_mw": edges[:-1], "bin_end_mw": edges[1:], "count": counts})


def add_uncertainty_band(points: pd.DataFrame, hour_stats: pd.DataFrame) -> pd.DataFrame:
    """Add the range the actual usually falls in, based on past errors at that hour of day.

    Since ``actual = forecast − error``, the P10–P90 error range becomes
    ``band_low = forecast − P90`` and ``band_high = forecast − P10`` (80% of past hours).
    """
    hour = points["start_time"].dt.tz_convert(config.TIMEZONE).dt.hour
    stats = hour_stats.set_index("hour")
    return points.assign(
        band_low_mw=points["forecast_mw"] - hour.map(stats["p90_mw"]),
        band_high_mw=points["forecast_mw"] - hour.map(stats["p10_mw"]),
    )


def _scored(df: pd.DataFrame) -> pd.DataFrame:
    """Only the hours that have both a forecast and an actual."""
    return df.dropna(subset=["error_mw"])


def _error_stats(scored: pd.DataFrame, key: pd.Series) -> pd.DataFrame:
    return (
        scored.assign(abs_error_mw=scored["error_mw"].abs())
        .groupby(key)
        .agg(
            mae_mw=("abs_error_mw", "mean"),
            bias_mw=("error_mw", "mean"),
            p10_mw=("error_mw", lambda e: e.quantile(0.1)),
            p90_mw=("error_mw", lambda e: e.quantile(0.9)),
            n=("error_mw", "size"),
        )
        .reset_index()
    )
