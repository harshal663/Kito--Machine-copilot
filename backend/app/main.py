"""FastAPI main application entry point."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.middleware import setup_middleware
from app.api.routes import (
    auth,
    devices,
    events,
    factories,
    health,
    machines,
    manuals,
    onboarding,
    stream,
    telemetry,
    users,
    webhooks,
)
from app.config import settings
from app.logging import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan setup and teardown."""
    setup_logging()
    yield


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    app = FastAPI(
        title="Proactive Edge-to-Voice Machine Copilot API",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # Standard error handling and request tracing
    setup_middleware(app)

    # CORS configuration (outermost so all error responses retain CORS headers)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    # Register routers
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(factories.router)
    app.include_router(onboarding.router)
    app.include_router(machines.router)
    app.include_router(devices.router)
    app.include_router(telemetry.router)
    app.include_router(events.router)
    app.include_router(webhooks.router)
    app.include_router(stream.router)
    app.include_router(manuals.router)

    return app


app = create_app()
