from datetime import UTC, date, datetime

import httpx
import pandas as pd
import pytest

from app.elexon import ACTUALS_COLUMNS, FORECASTS_COLUMNS, ElexonClient, ElexonError


def make_client(handler, retries=2):
    return ElexonClient(
        base_url="https://elexon.test",
        retries=retries,
        backoff_s=0,
        transport=httpx.MockTransport(handler),
    )


def counting(handler):
    """Wrap a handler so tests can check how many requests were made."""

    def wrapped(request):
        wrapped.calls += 1
        return handler(request)

    wrapped.calls = 0
    return wrapped


ACTUAL_ROWS = [
    {"startTime": "2026-01-02T00:30:00Z", "fuelType": "WIND", "generation": 8100},
    {"startTime": "2026-01-02T00:00:00Z", "fuelType": "WIND", "generation": 8000},
    {"startTime": "2026-01-02T00:00:00Z", "fuelType": "SOLAR", "generation": 0},
]

FORECAST_ROWS = [
    {
        "publishTime": "2026-01-01T07:30:00Z",
        "startTime": "2026-01-02T01:00:00Z",
        "generation": 9100,
    },
    {
        "publishTime": "2026-01-01T07:30:00Z",
        "startTime": "2026-01-02T00:00:00Z",
        "generation": 9000,
    },
    {
        "publishTime": "2026-01-01T04:30:00Z",
        "startTime": "2026-01-02T00:00:00Z",
        "generation": 8800,
    },
]


def test_fetch_wind_actuals_parses_filters_and_sorts():
    def handler(request):
        assert request.url.path == "/datasets/FUELHH/stream"
        assert request.url.params["settlementDateFrom"] == "2026-01-02"
        assert request.url.params["settlementDateTo"] == "2026-02-01"
        assert request.url.params["fuelType"] == "WIND"
        return httpx.Response(200, json=ACTUAL_ROWS)

    df = make_client(handler).fetch_wind_actuals(date(2026, 1, 2), date(2026, 2, 1))

    assert list(df.columns) == ACTUALS_COLUMNS
    assert len(df) == 2  # SOLAR row dropped
    assert df["start_time"].tolist() == [
        pd.Timestamp("2026-01-02T00:00:00Z"),
        pd.Timestamp("2026-01-02T00:30:00Z"),
    ]
    assert df["generation_mw"].tolist() == [8000.0, 8100.0]
    assert str(df["start_time"].dt.tz) == "UTC"


def test_fetch_wind_forecasts_parses_and_sorts():
    def handler(request):
        assert request.url.path == "/datasets/WINDFOR/stream"
        assert request.url.params["publishDateTimeFrom"] == "2025-12-31T00:00:00Z"
        assert request.url.params["publishDateTimeTo"] == "2026-02-01T00:00:00Z"
        return httpx.Response(200, json=FORECAST_ROWS)

    df = make_client(handler).fetch_wind_forecasts(
        datetime(2025, 12, 31, tzinfo=UTC), datetime(2026, 2, 1, tzinfo=UTC)
    )

    assert list(df.columns) == FORECASTS_COLUMNS
    assert df["publish_time"].tolist() == [
        pd.Timestamp("2026-01-01T04:30:00Z"),
        pd.Timestamp("2026-01-01T07:30:00Z"),
        pd.Timestamp("2026-01-01T07:30:00Z"),
    ]
    assert df["generation_mw"].tolist() == [8800.0, 9000.0, 9100.0]
    assert str(df["publish_time"].dt.tz) == "UTC"


def test_empty_response_gives_empty_frame_with_columns():
    client = make_client(lambda request: httpx.Response(200, json=[]))

    actuals = client.fetch_wind_actuals(date(2026, 1, 2), date(2026, 1, 2))
    forecasts = client.fetch_wind_forecasts(
        datetime(2026, 1, 1, tzinfo=UTC), datetime(2026, 1, 2, tzinfo=UTC)
    )

    assert actuals.empty and list(actuals.columns) == ACTUALS_COLUMNS
    assert forecasts.empty and list(forecasts.columns) == FORECASTS_COLUMNS


def test_retries_server_error_then_succeeds():
    responses = iter([httpx.Response(503), httpx.Response(200, json=ACTUAL_ROWS)])
    handler = counting(lambda request: next(responses))

    df = make_client(handler).fetch_wind_actuals(date(2026, 1, 2), date(2026, 1, 2))

    assert handler.calls == 2
    assert len(df) == 2


def test_retries_network_error_then_succeeds():
    def flaky(request):
        if handler.calls == 1:
            raise httpx.ConnectError("connection refused")
        return httpx.Response(200, json=ACTUAL_ROWS)

    handler = counting(flaky)

    df = make_client(handler).fetch_wind_actuals(date(2026, 1, 2), date(2026, 1, 2))

    assert handler.calls == 2
    assert len(df) == 2


def test_raises_after_all_retries_fail():
    handler = counting(lambda request: httpx.Response(500))

    with pytest.raises(ElexonError, match="failed after 3 attempts: HTTP 500"):
        make_client(handler, retries=2).fetch_wind_actuals(date(2026, 1, 2), date(2026, 1, 2))

    assert handler.calls == 3


def test_client_error_is_not_retried():
    handler = counting(lambda request: httpx.Response(400, text="bad date"))

    with pytest.raises(ElexonError, match="HTTP 400: bad date"):
        make_client(handler).fetch_wind_actuals(date(2026, 1, 2), date(2026, 1, 2))

    assert handler.calls == 1


def test_unexpected_json_shape_raises():
    client = make_client(lambda request: httpx.Response(200, json={"data": []}))

    with pytest.raises(ElexonError, match="expected a list"):
        client.fetch_wind_actuals(date(2026, 1, 2), date(2026, 1, 2))
