"""Telemetry input and response schemas per ARCHITECTURE.md §3.5."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class BaselineIn(BaseModel):
    """Vibration baseline parameters computed on device."""

    mean: float = Field(ge=0)
    std: float = Field(ge=0)


class PeakIn(BaseModel):
    """Vibration frequency peak detected by FFT."""

    freq_hz: float = Field(ge=0, le=500)
    amp_g: float = Field(ge=0)


class TelemetryIn(BaseModel):
    """Sensor anomaly payload posted on /v1/telemetry."""

    model_config = ConfigDict(extra="forbid")

    device_id: str = Field(pattern=r"^dev_[0-9A-HJKMNP-TV-Z]{26}$")
    machine_id: str = Field(pattern=r"^mch_[0-9A-HJKMNP-TV-Z]{26}$")
    ts: datetime
    seq: int = Field(ge=0)
    fs: Literal[1000]
    n: Literal[512]
    rms_g: float = Field(ge=0, le=64)
    baseline: BaselineIn
    z_score: float
    peaks: list[PeakIn] = Field(max_length=5)
    rpm_est: float | None = Field(default=None, ge=0, le=10000)
    fw: str = Field(max_length=16)


class TelemetryAccepted(BaseModel):
    """Response returned for telemetry ingest (HTTP 202)."""

    status: Literal["accepted", "suppressed"]
    event_id: str | None = None
