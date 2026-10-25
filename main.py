"""Vercel entry point.

Vercel runs this FastAPI app as one serverless function and serves the built React app
(frontend/dist, created by the build command in vercel.json) from its CDN. For local
development, run backend/ and frontend/ separately or use Docker (see README).
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

# Use the saved January snapshot by default: fast cold starts, and the data is identical to
# live because January 2026 no longer changes. Set DATA_SOURCE in Vercel to override.
if not os.environ.get("DATA_SOURCE", "").strip():
    os.environ["DATA_SOURCE"] = "snapshot"

from app.main import app  # noqa: E402

# Paths are relative to the project root, which is the working directory on Vercel.
app.frontend("/", directory="frontend/dist", fallback="index.html")
