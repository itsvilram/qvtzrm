from datetime import UTC, date, datetime, time

import pytest

from app import config
from app.config import DataSource, Settings, load_settings, parse_cutoff


def test_date_ranges_cover_january_decisions():
    assert config.DECISION_DATE_MIN == date(2026, 1, 1)
    assert config.DECISION_DATE_MAX == date(2026, 1, 31)
    assert config.DELIVERY_DATE_MIN == date(2026, 1, 2)
    assert config.DELIVERY_DATE_MAX == date(2026, 2, 1)


def test_forecast_publish_window_starts_one_day_early():
    assert config.FORECAST_PUBLISH_FROM == datetime(2025, 12, 31, tzinfo=UTC)
    assert config.FORECAST_PUBLISH_TO == datetime(2026, 2, 1, tzinfo=UTC)


def test_london_midnight_utc_handles_summer_time():
    # UK is UTC+1 in summer, so UK midnight is 23:00 UTC the day before.
    assert config.london_midnight_utc(date(2026, 7, 1)) == datetime(2026, 6, 30, 23, tzinfo=UTC)


def test_defaults_without_env():
    assert load_settings({}) == Settings()


def test_env_overrides():
    settings = load_settings(
        {
            "ELEXON_BASE_URL": "https://example.test/api/",
            "DEFAULT_CUTOFF": "09:50",
            "DATA_SOURCE": " Snapshot ",
            "CORS_ORIGINS": "http://a.test, http://b.test,",
        }
    )
    assert settings.elexon_base_url == "https://example.test/api"
    assert settings.default_cutoff == time(9, 50)
    assert settings.data_source is DataSource.SNAPSHOT
    assert settings.cors_origins == ("http://a.test", "http://b.test")


def test_invalid_data_source_lists_allowed_values():
    with pytest.raises(ValueError, match="expected one of auto, live, snapshot"):
        load_settings({"DATA_SOURCE": "database"})


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("09:00", time(9, 0)),
        ("00:00", time(0, 0)),
        ("23:59", time(23, 59)),
        (" 07:30 ", time(7, 30)),
    ],
)
def test_parse_cutoff_valid(value, expected):
    assert parse_cutoff(value) == expected


@pytest.mark.parametrize("value", ["9am", "9:00", "24:00", "09:60", "0900", ""])
def test_parse_cutoff_invalid(value):
    with pytest.raises(ValueError, match="expected 24-hour HH:MM"):
        parse_cutoff(value)
