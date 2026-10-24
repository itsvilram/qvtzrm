import pytest
from fastapi.testclient import TestClient

from app.config import DataSource
from app.main import app
from app.store import DataStore, get_store
from tests.samples import sample_snapshot

# Sample data: forecasts for 2026-01-02 00:00 and 01:00 UTC, published 1 Jan at 04:30 and 07:30;
# hourly actuals 9100 and 9500 MW.


def use_store(store):
    app.dependency_overrides[get_store] = lambda: store


@pytest.fixture
def client():
    use_store(DataStore(DataSource.SNAPSHOT, snapshot_loader=sample_snapshot))
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_meta(client):
    body = client.get("/api/meta").json()

    assert body == {
        "decision_date_min": "2026-01-01",
        "decision_date_max": "2026-01-31",
        "default_cutoff": "09:00",
        "timezone": "Europe/London",
        "publish_times_utc": ["04:30", "07:30"],
        "data_source": "snapshot",
        "fetched_at": "2026-10-24T12:00:00Z",
    }


def test_day_ahead(client):
    response = client.get("/api/day-ahead", params={"decision_date": "2026-01-01"})

    assert response.status_code == 200
    body = response.json()
    assert body["delivery_date"] == "2026-01-02"
    assert body["cutoff"] == "09:00"
    assert body["forecast_publish_times"] == ["2026-01-01T07:30:00Z"]
    assert body["points"][0] == {
        "start_time": "2026-01-02T00:00:00Z",
        "publish_time": "2026-01-01T07:30:00Z",
        "horizon_h": 16.5,
        "forecast_mw": 9600.0,
        "actual_mw": 9100.0,
        "error_mw": 500.0,
        # One day of data, so P10 = P90 = this hour's error and the band collapses to the actual.
        "band_low_mw": 9100.0,
        "band_high_mw": 9100.0,
    }
    assert body["summary"] == {
        "forecast_energy_mwh": 19400.0,
        "actual_energy_mwh": 18600.0,
        "peak_forecast_mw": 9800.0,
        "min_forecast_mw": 9600.0,
        "mae_mw": 400.0,
        "bias_mw": 400.0,
    }
    assert body["missing_forecast_hours"] == 22
    assert body["missing_actual_hours"] == 0


def test_day_ahead_earlier_cutoff_uses_earlier_forecast(client):
    body = client.get(
        "/api/day-ahead", params={"decision_date": "2026-01-01", "cutoff": "05:00"}
    ).json()

    assert body["forecast_publish_times"] == ["2026-01-01T04:30:00Z"]
    assert body["points"][0]["forecast_mw"] == 9900.0


def test_day_ahead_without_data_returns_empty_day(client):
    body = client.get("/api/day-ahead", params={"decision_date": "2026-01-20"}).json()

    assert body["points"] == []
    assert body["missing_forecast_hours"] == 24
    assert body["summary"]["forecast_energy_mwh"] == 0.0
    assert body["summary"]["mae_mw"] is None


def test_accuracy(client):
    response = client.get("/api/accuracy")

    assert response.status_code == 200
    body = response.json()
    assert body["cutoff"] == "09:00"
    assert body["period"] == {"delivery_from": "2026-01-02", "delivery_to": "2026-02-01"}
    assert body["summary"]["n_hours"] == 2
    assert body["summary"]["mae_mw"] == 400.0
    assert body["recommendation"]["coverage"] == 0.9
    assert [row["hour"] for row in body["by_hour"]] == [0, 1]
    assert sum(row["n"] for row in body["by_horizon"]) == 4
    assert body["daily"][0]["delivery_date"] == "2026-01-02"
    assert sum(b["count"] for b in body["histogram"]) == 2
    assert body["missing_forecast_hours"] == 744 - 2


@pytest.mark.parametrize(
    ("params", "message"),
    [
        (
            {"decision_date": "2026-02-15"},
            "decision_date must be between 2026-01-01 and 2026-01-31",
        ),
        ({"decision_date": "2026-01-15", "cutoff": "9am"}, "expected 24-hour HH:MM"),
    ],
)
def test_invalid_input_gives_422_with_clear_message(client, params, message):
    response = client.get("/api/day-ahead", params=params)

    assert response.status_code == 422
    assert message in response.json()["detail"]


def test_malformed_or_missing_date_gives_422(client):
    assert client.get("/api/day-ahead", params={"decision_date": "tomorrow"}).status_code == 422
    assert client.get("/api/day-ahead").status_code == 422
    assert client.get("/api/accuracy", params={"cutoff": "25:00"}).status_code == 422


def test_data_unavailable_gives_503():
    def broken_snapshot():
        raise FileNotFoundError("data/windfor.json.gz")

    use_store(DataStore(DataSource.SNAPSHOT, snapshot_loader=broken_snapshot))
    try:
        response = TestClient(app).get("/api/accuracy")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {"detail": "Data source unavailable"}


def test_docs_are_served(client):
    assert client.get("/api/docs").status_code == 200
    assert client.get("/api/openapi.json").status_code == 200
