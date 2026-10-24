"""Loads the wind data once and keeps it in memory for every request.

Where the data comes from is set by ``DATA_SOURCE``:
``live`` (Elexon API), ``snapshot`` (saved backup in ``data/``), or ``auto`` (live, falling back
to the snapshot if Elexon fails). January's data never changes, so it is never reloaded.
"""

import logging
import threading
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, time
from functools import lru_cache

import pandas as pd

from app import config
from app.actuals import to_hourly
from app.config import DataSource, settings
from app.elexon import ElexonClient
from app.forecasts import select_decision_forecasts
from app.metrics import by_horizon, join_actuals
from app.snapshot import Snapshot, load_snapshot

logger = logging.getLogger(__name__)


class DataUnavailableError(RuntimeError):
    """No data source could provide the wind data."""


@dataclass(frozen=True)
class Dataset:
    actuals_hourly: pd.DataFrame
    forecasts: pd.DataFrame
    source: DataSource  # LIVE or SNAPSHOT: where the data actually came from
    fetched_at: datetime  # when the data was fetched from Elexon


class DataStore:
    """Holds the dataset and cached analyses. Results are shared, so treat them as read-only."""

    def __init__(
        self,
        source: DataSource = settings.data_source,
        client_factory: Callable[[], ElexonClient] = ElexonClient,
        snapshot_loader: Callable[[], Snapshot] = load_snapshot,
    ) -> None:
        self._source = source
        self._client_factory = client_factory
        self._snapshot_loader = snapshot_loader
        self._lock = threading.Lock()
        self._dataset: Dataset | None = None
        # Caches belong to this instance, so a new store (e.g. in tests) starts empty.
        self.analysis = lru_cache(maxsize=32)(self._analysis)
        self.horizon_stats = lru_cache(maxsize=1)(self._horizon_stats)

    @property
    def dataset(self) -> Dataset:
        """The data, loaded on first use. Safe when several requests arrive at once."""
        if self._dataset is None:
            with self._lock:
                if self._dataset is None:  # another request may have loaded it while we waited
                    self._dataset = self._load()
        return self._dataset

    def _analysis(self, cutoff: time) -> pd.DataFrame:
        """Forecasts picked at ``cutoff``, joined with actuals. Cached per cutoff."""
        data = self.dataset
        return join_actuals(select_decision_forecasts(data.forecasts, cutoff), data.actuals_hourly)

    def _horizon_stats(self) -> pd.DataFrame:
        """Error by lead time over all forecasts. Doesn't depend on the cutoff, so cached once."""
        data = self.dataset
        return by_horizon(data.forecasts, data.actuals_hourly)

    def _load(self) -> Dataset:
        if self._source in (DataSource.LIVE, DataSource.AUTO):
            try:
                return self._load_live()
            # In auto mode any live failure (network, bad response, empty data) should fall back.
            except Exception as exc:
                if self._source is DataSource.LIVE:
                    raise DataUnavailableError(f"Live Elexon data unavailable: {exc}") from exc
                logger.warning("Live Elexon data unavailable (%s); using the saved snapshot", exc)

        try:
            return self._load_snapshot()
        except (OSError, ValueError, KeyError) as exc:
            raise DataUnavailableError(f"Snapshot data unavailable: {exc}") from exc

    def _load_live(self) -> Dataset:
        with self._client_factory() as client:
            actuals = client.fetch_wind_actuals(config.DELIVERY_DATE_MIN, config.DELIVERY_DATE_MAX)
            forecasts = client.fetch_wind_forecasts(
                config.FORECAST_PUBLISH_FROM, config.FORECAST_PUBLISH_TO
            )
        if actuals.empty or forecasts.empty:
            raise DataUnavailableError("Elexon returned no data")
        logger.info("Loaded live Elexon data")
        return Dataset(to_hourly(actuals), forecasts, DataSource.LIVE, datetime.now(UTC))

    def _load_snapshot(self) -> Dataset:
        snapshot = self._snapshot_loader()
        logger.info("Loaded snapshot data fetched at %s", snapshot.fetched_at)
        return Dataset(
            to_hourly(snapshot.actuals),
            snapshot.forecasts,
            DataSource.SNAPSHOT,
            snapshot.fetched_at,
        )


@lru_cache(maxsize=1)
def get_store() -> DataStore:
    """The one shared store used by the API."""
    return DataStore()
