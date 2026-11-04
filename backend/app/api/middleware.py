"""FastAPI middleware and error handlers producing the standard error envelope."""

import time
from collections.abc import Callable
from typing import Any

import structlog
from fastapi import FastAPI, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.errors import AppError, InternalError, ValidationError
from app.ids import generate_id

logger = structlog.get_logger()


def setup_middleware(app: FastAPI) -> None:
    """Register request tracing, access logging, and error envelope middleware."""

    @app.middleware("http")
    async def request_tracing_middleware(
        request: Request, call_next: Callable[[Request], Any]
    ) -> Response:
        req_id = request.headers.get("X-Request-ID") or generate_id("req_")
        request.state.request_id = req_id

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=req_id)

        start_time = time.perf_counter()
        try:
            response: Response = await call_next(request)
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.exception(
                "request_failed",
                method=request.method,
                path=request.url.path,
                duration_ms=duration_ms,
            )
            err_str = str(exc)
            if (
                "5432" in err_str
                or "Connect call failed" in err_str
                or "connection" in err_str.lower()
            ):
                user_msg = (
                    "Database connection failed. Please ensure PostgreSQL is running on port 5432."
                )
                code = "DATABASE_UNAVAILABLE"
            else:
                user_msg = "Internal server error occurred."
                code = "INTERNAL_ERROR"
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                headers={"X-Request-ID": req_id},
                content={
                    "error": {
                        "code": code,
                        "message": user_msg,
                        "request_id": req_id,
                        "details": {},
                    }
                },
            )

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        response.headers["X-Request-ID"] = req_id

        logger.info(
            "request_completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        return response

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        req_id = getattr(request.state, "request_id", generate_id("req_"))
        return JSONResponse(
            status_code=exc.http_status,
            headers={"X-Request-ID": req_id},
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "request_id": req_id,
                    "details": exc.details,
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        req_id = getattr(request.state, "request_id", generate_id("req_"))
        formatted_details: list[dict[str, str]] = []
        for err in exc.errors():
            loc = ".".join(str(item) for item in err.get("loc", []) if item != "body")
            formatted_details.append(
                {
                    "field": loc or "body",
                    "issue": err.get("msg", "invalid value"),
                }
            )

        err_obj = ValidationError()
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            headers={"X-Request-ID": req_id},
            content={
                "error": {
                    "code": err_obj.code,
                    "message": "Request validation failed.",
                    "request_id": req_id,
                    "details": formatted_details,
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        req_id = getattr(request.state, "request_id", generate_id("req_"))
        logger.error("unhandled_internal_error", error=str(exc))
        err_obj = InternalError()
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            headers={"X-Request-ID": req_id},
            content={
                "error": {
                    "code": err_obj.code,
                    "message": err_obj.default_message,
                    "request_id": req_id,
                    "details": {},
                }
            },
        )
