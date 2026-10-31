"""Error envelope schemas per ARCHITECTURE.md §3.3."""

from typing import Any

from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    """Inner error payload."""

    code: str = Field(description="Closed error code from registry")
    message: str = Field(description="Safe human-readable error message")
    request_id: str = Field(description="Request ID correlation string")
    details: dict[str, Any] | list[dict[str, Any]] = Field(
        default_factory=dict, description="Structured error details"
    )


class ErrorResponse(BaseModel):
    """Standard error response envelope."""

    error: ErrorDetail
