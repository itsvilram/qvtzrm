"""FastAPI application. Run locally with ``uvicorn app.main:app --reload`` from ``backend/``."""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routes import router
from app.store import DataUnavailableError

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


async def data_unavailable(request: Request, exc: DataUnavailableError) -> JSONResponse:
    logger.error("Data unavailable: %s", exc)
    return JSONResponse(status_code=503, content={"detail": "Data source unavailable"})


def create_app() -> FastAPI:
    app = FastAPI(
        title="Wind Forecast Monitor API",
        description="GB national wind forecasts vs actuals for January 2026 day-ahead decisions.",
        version="1.0.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    app.add_exception_handler(DataUnavailableError, data_unavailable)
    app.include_router(router)
    return app


app = create_app()
