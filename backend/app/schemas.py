"""API response models. Field names match the frontend's TypeScript types."""

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, PlainSerializer

# Numbers are rounded to 1 decimal place in responses; full precision is kept internally.
Rounded = Annotated[float, PlainSerializer(lambda value: round(value, 1), return_type=float)]


class Meta(BaseModel):
    decision_date_min: date
    decision_date_max: date
    default_cutoff: str
    timezone: str
    publish_times_utc: list[str]
    data_source: Literal["live", "snapshot"]
    fetched_at: datetime


class DayAheadPoint(BaseModel):
    start_time: datetime
    publish_time: datetime
    horizon_h: Rounded
    forecast_mw: Rounded
    actual_mw: Rounded | None
    error_mw: Rounded | None
    band_low_mw: Rounded | None
    band_high_mw: Rounded | None


class DayAheadSummary(BaseModel):
    forecast_energy_mwh: Rounded
    actual_energy_mwh: Rounded | None  # None unless every hour has an actual
    peak_forecast_mw: Rounded | None
    min_forecast_mw: Rounded | None
    mae_mw: Rounded | None
    bias_mw: Rounded | None


class DayAhead(BaseModel):
    decision_date: date
    delivery_date: date
    cutoff: str
    forecast_publish_times: list[datetime]
    summary: DayAheadSummary
    points: list[DayAheadPoint]
    missing_forecast_hours: int
    missing_actual_hours: int


class Period(BaseModel):
    delivery_from: date
    delivery_to: date


class AccuracySummary(BaseModel):
    n_hours: int
    mae_mw: Rounded | None
    rmse_mw: Rounded | None
    bias_mw: Rounded | None
    nmae_pct: Rounded | None
    p10_mw: Rounded | None
    p50_mw: Rounded | None
    p90_mw: Rounded | None
    p90_abs_mw: Rounded | None
    max_over_mw: Rounded | None
    max_under_mw: Rounded | None


class Recommendation(BaseModel):
    coverage: float
    buffer_mw: Rounded | None


class ErrorStats(BaseModel):
    mae_mw: Rounded
    bias_mw: Rounded
    p10_mw: Rounded
    p90_mw: Rounded
    n: int


class HourStats(ErrorStats):
    hour: int


class HorizonStats(ErrorStats):
    bucket: str
    bucket_start_h: int


class DailyStats(ErrorStats):
    delivery_date: date
    forecast_energy_mwh: Rounded
    actual_energy_mwh: Rounded


class HistogramBin(BaseModel):
    bin_start_mw: Rounded
    bin_end_mw: Rounded
    count: int


class Accuracy(BaseModel):
    cutoff: str
    period: Period
    summary: AccuracySummary
    recommendation: Recommendation
    by_hour: list[HourStats]
    by_horizon: list[HorizonStats]
    daily: list[DailyStats]
    histogram: list[HistogramBin]
    missing_forecast_hours: int
