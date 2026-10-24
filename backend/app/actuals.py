"""Turn half-hourly actual wind generation into hourly values that line up with the forecasts."""

import logging

import pandas as pd

logger = logging.getLogger(__name__)

HOURLY_ACTUALS_COLUMNS = ["start_time", "actual_mw"]


def to_hourly(actuals: pd.DataFrame) -> pd.DataFrame:
    """Average the two half-hours (HH:00 and HH:30) of each hour into one hourly value.

    WINDFOR forecasts are hourly, while FUELHH actuals are the average MW over each half-hour.
    The mean of the two half-hours is therefore the average MW over the hour, which is what each
    hourly forecast is compared with. Hours missing either half-hour are dropped rather than
    guessed. If the same half-hour appears twice, the last value wins.

    Returns columns ``start_time`` (UTC, on the hour) and ``actual_mw``, sorted by time.
    """
    deduped = actuals.drop_duplicates("start_time", keep="last")
    hourly = deduped.groupby(deduped["start_time"].dt.floor("h")).agg(
        actual_mw=("generation_mw", "mean"),
        half_hours=("generation_mw", "size"),
    )

    complete = hourly[hourly["half_hours"] == 2]
    if dropped := len(hourly) - len(complete):
        logger.warning("Dropped %d hour(s) of actuals with a missing half-hour", dropped)

    return complete[["actual_mw"]].reset_index()
