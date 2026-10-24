"""Client for the Elexon BMRS Insights API: national wind actuals and wind forecasts.

Only the two stream endpoints the app needs are wrapped. Responses are turned into small
DataFrames with UTC timestamps, so the rest of the backend never handles raw JSON.
"""

import logging
import time
from datetime import UTC, date, datetime
from typing import Any

import httpx
import pandas as pd

from app.config import settings

logger = logging.getLogger(__name__)

ACTUALS_COLUMNS = ["start_time", "generation_mw"]
FORECASTS_COLUMNS = ["publish_time", "start_time", "generation_mw"]


class ElexonError(RuntimeError):
    """The Elexon API could not be reached or returned an unusable response."""


class ElexonClient:
    """Fetches wind data from Elexon, retrying network errors and 5xx responses.

    ``retries`` is the number of extra attempts after the first one; the wait between
    attempts doubles each time (``backoff_s``, ``2 * backoff_s``, ...). 4xx responses are
    not retried because the request itself is wrong.
    """

    def __init__(
        self,
        base_url: str = settings.elexon_base_url,
        timeout_s: float = settings.http_timeout_s,
        retries: int = settings.http_retries,
        backoff_s: float = 1.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._http = httpx.Client(base_url=base_url, timeout=timeout_s, transport=transport)
        self._retries = retries
        self._backoff_s = backoff_s

    def __enter__(self) -> "ElexonClient":
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()

    def close(self) -> None:
        self._http.close()

    def fetch_wind_actuals(self, from_date: date, to_date: date) -> pd.DataFrame:
        """Half-hourly wind generation for settlement dates ``from_date``..``to_date`` (inclusive).

        Returns columns ``start_time`` (UTC) and ``generation_mw``, sorted by ``start_time``.
        """
        rows = self._get_rows(
            "/datasets/FUELHH/stream",
            {
                "settlementDateFrom": from_date.isoformat(),
                "settlementDateTo": to_date.isoformat(),
                "fuelType": "WIND",
            },
        )
        # The API already filters by fuel type; checking again guards against a changed API.
        wind_rows = [row for row in rows if row.get("fuelType") == "WIND"]
        df = _to_frame(wind_rows, {"startTime": "start_time", "generation": "generation_mw"})
        return df.sort_values("start_time", ignore_index=True)

    def fetch_wind_forecasts(self, publish_from: datetime, publish_to: datetime) -> pd.DataFrame:
        """Hourly wind forecasts published between ``publish_from`` and ``publish_to``.

        Returns columns ``publish_time`` and ``start_time`` (both UTC) and ``generation_mw``,
        sorted by ``publish_time`` then ``start_time``.
        """
        rows = self._get_rows(
            "/datasets/WINDFOR/stream",
            {
                "publishDateTimeFrom": _format_utc(publish_from),
                "publishDateTimeTo": _format_utc(publish_to),
            },
        )
        df = _to_frame(
            rows,
            {
                "publishTime": "publish_time",
                "startTime": "start_time",
                "generation": "generation_mw",
            },
        )
        return df.sort_values(["publish_time", "start_time"], ignore_index=True)

    def _get_rows(self, path: str, params: dict[str, str]) -> list[dict[str, Any]]:
        attempts = self._retries + 1
        last_error = ""
        for attempt in range(1, attempts + 1):
            try:
                response = self._http.get(path, params=params)
            except httpx.TransportError as exc:  # connection failure, timeout, ...
                last_error = f"{type(exc).__name__}: {exc}"
            else:
                if response.status_code < 500:
                    return _parse_rows(path, response)
                last_error = f"HTTP {response.status_code}"

            if attempt < attempts:
                delay = self._backoff_s * 2 ** (attempt - 1)
                logger.warning("Elexon %s failed (%s), retrying in %.1fs", path, last_error, delay)
                time.sleep(delay)

        raise ElexonError(f"Elexon {path} failed after {attempts} attempts: {last_error}")


def _parse_rows(path: str, response: httpx.Response) -> list[dict[str, Any]]:
    if response.is_error:
        raise ElexonError(
            f"Elexon {path} returned HTTP {response.status_code}: {response.text[:200]}"
        )
    try:
        payload = response.json()
    except ValueError as exc:
        raise ElexonError(f"Elexon {path} returned invalid JSON") from exc
    if not isinstance(payload, list):
        raise ElexonError(f"Elexon {path} returned {type(payload).__name__}, expected a list")
    logger.info("Elexon %s returned %d rows", path, len(payload))
    return payload


def _to_frame(rows: list[dict[str, Any]], fields: dict[str, str]) -> pd.DataFrame:
    """Keep only ``fields`` (API name -> column name) and parse ``*_time`` columns as UTC."""
    df = pd.DataFrame(rows, columns=list(fields)).rename(columns=fields)
    for column in df.columns:
        if column.endswith("_time"):
            df[column] = pd.to_datetime(df[column], utc=True)
    df["generation_mw"] = df["generation_mw"].astype(float)
    return df


def _format_utc(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
