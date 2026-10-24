import logging
import threading
import time as time_module
from datetime import time

import pandas as pd
import pytest

from app.config import DataSource
from app.elexon import ElexonError
from app.store import DataStore, DataUnavailableError
from tests.samples import SNAPSHOT_FETCHED_AT, sample_actuals, sample_forecasts

NINE = time(9, 0)


class FakeClient:
    """Stands in for ElexonClient. Counts how often it is created."""

    created = 0

    def __init__(self, actuals=None, forecasts=None, error=None, delay_s=0.0):
        self.actuals = sample_actuals() if actuals is None else actuals
        self.forecasts = sample_forecasts() if forecasts is None else forecasts
        self.error = error
        self.delay_s = delay_s

    def factory(self):
        FakeClient.created += 1
        return self

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        pass

    def fetch_wind_actuals(self, from_date, to_date):
        time_module.sleep(self.delay_s)
        if self.error:
            raise self.error
        return self.actuals

    def fetch_wind_forecasts(self, publish_from, publish_to):
        return self.forecasts


@pytest.fixture(autouse=True)
def reset_counter():
    FakeClient.created = 0


def failing_snapshot():
    raise FileNotFoundError("data/windfor.json.gz")


def test_live_mode_uses_elexon(snapshot):
    store = DataStore(DataSource.LIVE, FakeClient().factory, lambda: snapshot)

    data = store.dataset

    assert data.source is DataSource.LIVE
    assert len(data.actuals_hourly) == 2  # 4 half-hours → 2 hours
    assert len(data.forecasts) == 4


def test_auto_falls_back_to_snapshot_when_live_fails(snapshot, caplog):
    client = FakeClient(error=ElexonError("HTTP 503"))
    store = DataStore(DataSource.AUTO, client.factory, lambda: snapshot)

    with caplog.at_level(logging.WARNING):
        data = store.dataset

    assert data.source is DataSource.SNAPSHOT
    assert data.fetched_at == SNAPSHOT_FETCHED_AT
    assert "using the saved snapshot" in caplog.text


def test_auto_falls_back_when_live_returns_no_data(snapshot):
    client = FakeClient(actuals=sample_actuals().iloc[0:0])
    store = DataStore(DataSource.AUTO, client.factory, lambda: snapshot)

    assert store.dataset.source is DataSource.SNAPSHOT


def test_live_mode_does_not_fall_back(snapshot):
    client = FakeClient(error=ElexonError("HTTP 503"))
    store = DataStore(DataSource.LIVE, client.factory, lambda: snapshot)

    with pytest.raises(DataUnavailableError, match="Live Elexon data unavailable"):
        _ = store.dataset


def test_snapshot_mode_never_calls_elexon(snapshot):
    store = DataStore(DataSource.SNAPSHOT, FakeClient().factory, lambda: snapshot)

    assert store.dataset.source is DataSource.SNAPSHOT
    assert FakeClient.created == 0


def test_both_sources_failing_raises_and_retries_next_time(snapshot):
    client = FakeClient(error=ElexonError("HTTP 503"))
    loader = {"fn": failing_snapshot}
    store = DataStore(DataSource.AUTO, client.factory, lambda: loader["fn"]())

    with pytest.raises(DataUnavailableError, match="Snapshot data unavailable"):
        _ = store.dataset

    loader["fn"] = lambda: snapshot  # e.g. the file is restored
    assert store.dataset.source is DataSource.SNAPSHOT


def test_loads_only_once():
    store = DataStore(DataSource.LIVE, FakeClient().factory)

    for _ in range(5):
        assert store.dataset.source is DataSource.LIVE

    assert FakeClient.created == 1


def test_loads_only_once_when_requests_arrive_together():
    store = DataStore(DataSource.LIVE, FakeClient(delay_s=0.05).factory)
    threads = [threading.Thread(target=lambda: store.dataset) for _ in range(8)]

    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert FakeClient.created == 1


def test_analysis_is_cached_per_cutoff():
    store = DataStore(DataSource.LIVE, FakeClient().factory)

    first = store.analysis(NINE)

    assert store.analysis(NINE) is first
    assert store.analysis(time(4, 0)) is not first
    # 09:00 picks the 07:30 forecast: 9600 vs actual mean(9000, 9200) = 9100 → +500.
    assert first["error_mw"].tolist() == [500.0, 300.0]
    assert (first["publish_time"] == pd.Timestamp("2026-01-01T07:30Z")).all()


def test_horizon_stats_are_cached():
    store = DataStore(DataSource.LIVE, FakeClient().factory)

    first = store.horizon_stats()

    assert store.horizon_stats() is first
    assert first["n"].sum() == 4  # both publishes × both hours
