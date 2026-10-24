"""Saved copy of the January data, used when the live Elexon API is unavailable.

Refresh it with ``python -m app.snapshot`` (run from ``backend/``). Each dataset is stored as
gzipped JSON: ``{"dataset", "fetched_at", "columns", "rows"}``, with times as ISO-8601 UTC strings.
"""

import gzip
import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

from app import config
from app.elexon import ElexonClient

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
ACTUALS_FILE = "fuelhh_wind.json.gz"
FORECASTS_FILE = "windfor.json.gz"

_TIME_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


@dataclass(frozen=True)
class Snapshot:
    actuals: pd.DataFrame
    forecasts: pd.DataFrame
    fetched_at: datetime


def save_snapshot(
    actuals: pd.DataFrame,
    forecasts: pd.DataFrame,
    fetched_at: datetime,
    data_dir: Path = DATA_DIR,
) -> list[Path]:
    """Write both datasets to ``data_dir`` and return the file paths."""
    data_dir.mkdir(parents=True, exist_ok=True)
    paths = [data_dir / ACTUALS_FILE, data_dir / FORECASTS_FILE]
    _write(paths[0], "FUELHH", actuals, fetched_at)
    _write(paths[1], "WINDFOR", forecasts, fetched_at)
    return paths


def load_snapshot(data_dir: Path = DATA_DIR) -> Snapshot:
    """Read both datasets back, with the same columns and types the Elexon client returns."""
    actuals, fetched_at = _read(data_dir / ACTUALS_FILE)
    forecasts, _ = _read(data_dir / FORECASTS_FILE)
    return Snapshot(actuals=actuals, forecasts=forecasts, fetched_at=fetched_at)


def _write(path: Path, dataset: str, df: pd.DataFrame, fetched_at: datetime) -> None:
    out = df.copy()
    for column in out.columns:
        if column.endswith("_time"):
            out[column] = out[column].dt.strftime(_TIME_FORMAT)
    payload = {
        "dataset": dataset,
        "fetched_at": fetched_at.astimezone(UTC).strftime(_TIME_FORMAT),
        "columns": list(out.columns),
        "rows": out.to_numpy().tolist(),
    }
    # mtime=0 keeps the file identical when the data is unchanged, so git shows no diff.
    with gzip.GzipFile(path, "wb", mtime=0) as file:
        file.write(json.dumps(payload, separators=(",", ":")).encode())


def _read(path: Path) -> tuple[pd.DataFrame, datetime]:
    with gzip.open(path, "rb") as file:
        payload = json.loads(file.read())
    df = pd.DataFrame(payload["rows"], columns=payload["columns"])
    for column in df.columns:
        if column.endswith("_time"):
            df[column] = pd.to_datetime(df[column], utc=True)
    df["generation_mw"] = df["generation_mw"].astype(float)
    return df, datetime.fromisoformat(payload["fetched_at"])


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)

    with ElexonClient() as client:
        actuals = client.fetch_wind_actuals(config.DELIVERY_DATE_MIN, config.DELIVERY_DATE_MAX)
        forecasts = client.fetch_wind_forecasts(
            config.FORECAST_PUBLISH_FROM, config.FORECAST_PUBLISH_TO
        )
    paths = save_snapshot(actuals, forecasts, fetched_at=datetime.now(UTC))

    print(f"Actuals:   {len(actuals):>6} rows, {_range(actuals['start_time'])}")
    print(f"Forecasts: {len(forecasts):>6} rows, published {_range(forecasts['publish_time'])}")
    for path in paths:
        print(f"Wrote {path} ({path.stat().st_size / 1024:.0f} KB)")


def _range(times: pd.Series) -> str:
    return f"{times.min():%Y-%m-%d %H:%M} -> {times.max():%Y-%m-%d %H:%M} UTC"


if __name__ == "__main__":
    main()
