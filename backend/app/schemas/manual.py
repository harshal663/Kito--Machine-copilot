"""Manual schemas per ARCHITECTURE.md §3.4 and §3.5."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ManualOut(BaseModel):
    """Machine manual ingestion and status response."""

    id: str = Field(pattern=r"^man_[0-9A-HJKMNP-TV-Z]{26}$")
    machine_id: str | None = Field(default=None, pattern=r"^mch_[0-9A-HJKMNP-TV-Z]{26}$")
    filename: str
    page_count: int | None = None
    status: Literal["PROCESSING", "READY", "FAILED"]
    embedding_model: str
    error_code: str | None = None
    created_at: datetime
