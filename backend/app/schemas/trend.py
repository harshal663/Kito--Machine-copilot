"""Trend point and test call schemas per ARCHITECTURE.md §3.4 and §3.5."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class TrendPointOut(BaseModel):
    """Single vibration trend observation."""

    ts: datetime
    rms_g: float
    band_energy: dict[str, Any] | None = None
    source: Literal["alert_window", "hourly_rollup"]


class TrendOut(BaseModel):
    """Trend points response container for charts."""

    machine_id: str = Field(pattern=r"^mch_[0-9A-HJKMNP-TV-Z]{26}$")
    points: list[TrendPointOut] = Field(default_factory=list)


class TestCallAccepted(BaseModel):
    """Response returned when initiating a test call."""

    status: Literal["accepted"] = "accepted"
    machine_id: str = Field(pattern=r"^mch_[0-9A-HJKMNP-TV-Z]{26}$")
