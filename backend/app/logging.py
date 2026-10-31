"""Structured logging configuration using structlog."""

import logging
import sys
from typing import cast

import structlog

from app.config import settings


def mask_phone(phone: str | None) -> str:
    """Mask phone number, showing only the last 4 digits."""
    if not phone or len(phone) < 4:
        return "****"
    return f"{'*' * (len(phone) - 4)}{phone[-4:]}"


def setup_logging() -> None:
    """Configure structlog processors and standard library logging integration."""
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if settings.APP_ENV == "development":
        renderer: structlog.types.Processor = structlog.dev.ConsoleRenderer()
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.UnicodeDecoder(),
            renderer,
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Return a structlog bound logger."""
    return cast(structlog.stdlib.BoundLogger, structlog.get_logger(name))


logger = structlog.get_logger()
