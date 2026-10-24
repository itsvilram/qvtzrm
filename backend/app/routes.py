"""API endpoints, all under /api so paths are the same locally, in Docker and on Vercel."""

from datetime import date, time, timedelta
from typing import Annotated, Any

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query

from app import config, metrics
from app.config import parse_cutoff, settings
from app.schemas import (
    Accuracy,
    AccuracySummary,
    DayAhead,
    DayAheadSummary,
    Meta,
    Period,
    Recommendation,
)
from app.store import DataStore, get_store

router = APIRouter(prefix="/api")


def cutoff_param(
    cutoff: Annotated[
        str | None,
        Query(
            description="Decision cutoff in UK time, HH:MM. Defaults to 09:00.", examples=["09:00"]
        ),
    ] = None,
) -> time:
    if cutoff is None:
        return settings.default_cutoff
    try:
        return parse_cutoff(cutoff)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None


def decision_date_param(
    decision_date: Annotated[
        date,
        Query(description="Day the purchase decision is made (2026-01-01 to 2026-01-31)."),
    ],
) -> date:
    if not config.DECISION_DATE_MIN <= decision_date <= config.DECISION_DATE_MAX:
        raise HTTPException(
            status_code=422,
            detail=(
                f"decision_date must be between {config.DECISION_DATE_MIN} "
                f"and {config.DECISION_DATE_MAX}"
            ),
        )
    return decision_date


StoreDep = Annotated[DataStore, Depends(get_store)]
Cutoff = Annotated[time, Depends(cutoff_param)]
DecisionDate = Annotated[date, Depends(decision_date_param)]


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness check. Doesn't touch the data, so it stays fast."""
    return {"status": "ok"}


@router.get("/meta")
def meta(store: StoreDep) -> Meta:
    """Available dates, defaults, and where the data came from."""
    data = store.dataset
    return Meta(
        decision_date_min=config.DECISION_DATE_MIN,
        decision_date_max=config.DECISION_DATE_MAX,
        default_cutoff=f"{settings.default_cutoff:%H:%M}",
        timezone=str(config.TIMEZONE),
        publish_times_utc=sorted(data.forecasts["publish_time"].dt.strftime("%H:%M").unique()),
        data_source=data.source.value,
        fetched_at=data.fetched_at,
    )


@router.get("/day-ahead")
def day_ahead(decision_date: DecisionDate, cutoff: Cutoff, store: StoreDep) -> DayAhead:
    """The delivery-day forecast as it stood at the cutoff, next to what actually happened."""
    analysis = store.analysis(cutoff)
    day = analysis[analysis["decision_date"] == decision_date]
    points = metrics.add_uncertainty_band(day, metrics.by_hour(analysis))
    delivery_date = decision_date + timedelta(days=1)
    missing_actual = int(day["actual_mw"].isna().sum())
    stats = metrics.summary(day)
    has_points = not day.empty

    return DayAhead(
        decision_date=decision_date,
        delivery_date=delivery_date,
        cutoff=f"{cutoff:%H:%M}",
        forecast_publish_times=sorted(day["publish_time"].unique()),
        summary=DayAheadSummary(
            forecast_energy_mwh=day["forecast_mw"].sum(),  # hourly MW summed = MWh
            actual_energy_mwh=(
                day["actual_mw"].sum() if has_points and missing_actual == 0 else None
            ),
            peak_forecast_mw=day["forecast_mw"].max() if has_points else None,
            min_forecast_mw=day["forecast_mw"].min() if has_points else None,
            mae_mw=stats["mae_mw"],
            bias_mw=stats["bias_mw"],
        ),
        points=_records(points),
        missing_forecast_hours=_hours_in(delivery_date, delivery_date) - len(day),
        missing_actual_hours=missing_actual,
    )


@router.get("/accuracy")
def accuracy(cutoff: Cutoff, store: StoreDep) -> Accuracy:
    """How accurate the forecasts available at the cutoff were, over all of January."""
    analysis = store.analysis(cutoff)
    expected_hours = _hours_in(config.DELIVERY_DATE_MIN, config.DELIVERY_DATE_MAX)

    return Accuracy(
        cutoff=f"{cutoff:%H:%M}",
        period=Period(delivery_from=config.DELIVERY_DATE_MIN, delivery_to=config.DELIVERY_DATE_MAX),
        summary=AccuracySummary(**metrics.summary(analysis)),
        recommendation=Recommendation(**metrics.recommendation(analysis)),
        by_hour=_records(metrics.by_hour(analysis)),
        by_horizon=_records(store.horizon_stats()),
        daily=_records(metrics.daily(analysis)),
        histogram=_records(metrics.histogram(analysis)),
        missing_forecast_hours=expected_hours - len(analysis),
    )


def _records(df: pd.DataFrame) -> list[dict[str, Any]]:
    """DataFrame rows as dicts, with NaN turned into None (JSON null)."""
    return df.astype(object).where(df.notna(), None).to_dict("records")


def _hours_in(first_day: date, last_day: date) -> int:
    """Hours in UK days ``first_day``..``last_day`` (a clock-change day has 23 or 25)."""
    start = config.london_midnight_utc(first_day)
    end = config.london_midnight_utc(last_day + timedelta(days=1))
    return int((end - start).total_seconds() // 3600)
