"""Settings for the backend.

Fixed facts about the challenge (dates, timezone) are module constants.
Values that can differ per environment (URLs, cutoff, data source, CORS) live in
``Settings`` and can be overridden with environment variables.
"""

import os
import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from enum import StrEnum
from zoneinfo import ZoneInfo

TIMEZONE = ZoneInfo("Europe/London")

# Purchase decisions in scope: every day of January 2026 (from the brief).
DECISION_DATE_MIN = date(2026, 1, 1)
DECISION_DATE_MAX = date(2026, 1, 31)

# Each decision buys power for the next day.
DELIVERY_DATE_MIN = DECISION_DATE_MIN + timedelta(days=1)
DELIVERY_DATE_MAX = DECISION_DATE_MAX + timedelta(days=1)


def london_midnight_utc(day: date) -> datetime:
    """Return the start of ``day`` in UK time, as a UTC datetime."""
    return datetime.combine(day, time(0, 0), tzinfo=TIMEZONE).astimezone(UTC)


# Forecasts that could be used for those decisions. The window starts one day early so a
# very early cutoff on 1 Jan can still use the forecast published the evening before.
FORECAST_PUBLISH_FROM = london_midnight_utc(DECISION_DATE_MIN - timedelta(days=1))
FORECAST_PUBLISH_TO = london_midnight_utc(DECISION_DATE_MAX + timedelta(days=1))

_CUTOFF_PATTERN = re.compile(r"([01]\d|2[0-3]):([0-5]\d)")


def parse_cutoff(value: str) -> time:
    """Parse a decision cutoff in 24-hour ``HH:MM`` format (UK time), e.g. ``"09:00"``."""
    match = _CUTOFF_PATTERN.fullmatch(value.strip())
    if match is None:
        raise ValueError(f"Invalid cutoff {value!r}: expected 24-hour HH:MM, e.g. '09:00'")
    return time(int(match[1]), int(match[2]))


class DataSource(StrEnum):
    AUTO = "auto"  # try the live Elexon API, fall back to the saved snapshot
    LIVE = "live"
    SNAPSHOT = "snapshot"


@dataclass(frozen=True)
class Settings:
    elexon_base_url: str = "https://data.elexon.co.uk/bmrs/api/v1"
    # 09:00 UK time is before both GB day-ahead auction gate closures
    # (EPEX SPOT ~09:20, N2EX ~09:50), leaving the trader time to act.
    default_cutoff: time = time(9, 0)
    data_source: DataSource = DataSource.AUTO
    cors_origins: tuple[str, ...] = ("http://localhost:5173",)
    http_timeout_s: float = 30.0
    http_retries: int = 3


def load_settings(env: Mapping[str, str] = os.environ) -> Settings:
    """Build settings from the defaults plus any environment variable overrides."""
    defaults = Settings()

    raw_source = env.get("DATA_SOURCE", defaults.data_source.value).strip().lower()
    try:
        data_source = DataSource(raw_source)
    except ValueError:
        allowed = ", ".join(source.value for source in DataSource)
        raise ValueError(f"Invalid DATA_SOURCE {raw_source!r}: expected one of {allowed}") from None

    cors_origins = defaults.cors_origins
    if "CORS_ORIGINS" in env:
        cors_origins = tuple(o.strip() for o in env["CORS_ORIGINS"].split(",") if o.strip())

    return Settings(
        elexon_base_url=env.get("ELEXON_BASE_URL", defaults.elexon_base_url).rstrip("/"),
        default_cutoff=(
            parse_cutoff(env["DEFAULT_CUTOFF"])
            if "DEFAULT_CUTOFF" in env
            else defaults.default_cutoff
        ),
        data_source=data_source,
        cors_origins=cors_origins,
    )


settings = load_settings()
