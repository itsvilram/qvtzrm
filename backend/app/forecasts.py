"""Pick, for every delivery hour, the forecast a trader could actually have used.

The purchase decision for delivery day D+1 is made on day D at the decision cutoff (UK time).
For each target hour on D+1 we take the most recent forecast published at or before that
cutoff. Forecasts published later did not exist when the decision was made, so using them
would make the forecasts look more accurate than they were in practice.
"""

from datetime import date, datetime, time, timedelta

import pandas as pd

from app import config

SELECTED_COLUMNS = ["start_time", "decision_date", "publish_time", "horizon_h", "forecast_mw"]


def decision_cutoff_utc(delivery_date: date, cutoff: time) -> pd.Timestamp:
    """UTC time of the decision for ``delivery_date``: ``cutoff`` UK time on the day before."""
    decision_date = delivery_date - timedelta(days=1)
    local = datetime.combine(decision_date, cutoff, tzinfo=config.TIMEZONE)
    return pd.Timestamp(local).tz_convert("UTC")


def select_decision_forecasts(
    forecasts: pd.DataFrame,
    cutoff: time,
    delivery_from: date = config.DELIVERY_DATE_MIN,
    delivery_to: date = config.DELIVERY_DATE_MAX,
) -> pd.DataFrame:
    """For each target hour on delivery days ``delivery_from``..``delivery_to`` (UK dates), keep
    the latest forecast published at or before that day's decision cutoff.

    A forecast published exactly at the cutoff counts as available. Target hours with no
    forecast published before the cutoff are left out.

    Returns columns ``start_time``, ``decision_date``, ``publish_time``, ``horizon_h`` (hours
    between publication and the target hour) and ``forecast_mw``, sorted by ``start_time``.
    """
    df = forecasts.rename(columns={"generation_mw": "forecast_mw"})
    delivery_date = df["start_time"].dt.tz_convert(config.TIMEZONE).dt.date
    in_range = (delivery_date >= delivery_from) & (delivery_date <= delivery_to)
    df = df[in_range].assign(delivery_date=delivery_date[in_range])

    # Only ~30 distinct delivery days, so compute each day's cutoff once and look it up.
    cutoffs = {day: decision_cutoff_utc(day, cutoff) for day in df["delivery_date"].unique()}
    cutoff_time = pd.to_datetime(df["delivery_date"].map(cutoffs), utc=True)
    eligible = df[df["publish_time"] <= cutoff_time]

    latest = (
        eligible.sort_values("publish_time")
        .drop_duplicates("start_time", keep="last")
        .sort_values("start_time", ignore_index=True)
    )
    latest["decision_date"] = latest["delivery_date"] - timedelta(days=1)
    latest["horizon_h"] = (latest["start_time"] - latest["publish_time"]).dt.total_seconds() / 3600
    return latest[SELECTED_COLUMNS]
