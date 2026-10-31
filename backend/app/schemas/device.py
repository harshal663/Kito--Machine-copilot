"""Device schemas per ARCHITECTURE.md §3.5 and BUILD_NOTES.md."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class DeviceCreate(BaseModel):
    """Payload to bind a new device to a machine."""

    machine_id: str = Field(pattern=r"^mch_[0-9A-HJKMNP-TV-Z]{26}$")


class DeviceCreated(BaseModel):
    """Response returned once when binding a new device."""

    device_id: str = Field(pattern=r"^dev_[0-9A-HJKMNP-TV-Z]{26}$")
    machine_id: str = Field(pattern=r"^mch_[0-9A-HJKMNP-TV-Z]{26}$")
    device_key: str = Field(description="Raw device key shown once; cannot be retrieved again")
    created_at: datetime


class DeviceSampling(BaseModel):
    """Device sampling settings."""

    fs: Literal[1000] = 1000
    n: Literal[512] = 512
    interval_s: int = 10


class DeviceThresholds(BaseModel):
    """Device anomaly detection thresholds."""

    k_sigma: float = 3.0
    m_windows: int = 3
    idle_rms_g: float = 0.05


class DeviceConfig(BaseModel):
    """Configuration served to the sensor node on GET /v1/devices/me/config."""

    machine_id: str = Field(pattern=r"^mch_[0-9A-HJKMNP-TV-Z]{26}$")
    sampling: DeviceSampling = Field(default_factory=DeviceSampling)
    thresholds: DeviceThresholds = Field(default_factory=DeviceThresholds)
    heartbeat_s: int = 300


class HeartbeatIn(BaseModel):
    """Sensor heartbeat payload per BUILD_NOTES.md §1."""

    device_id: str = Field(pattern=r"^dev_[0-9A-HJKMNP-TV-Z]{26}$")
    machine_id: str = Field(pattern=r"^mch_[0-9A-HJKMNP-TV-Z]{26}$")
    fw: str = Field(max_length=16)
    mode: Literal["LEARNING", "MONITORING"]
    errors_since_boot: int = Field(ge=0, default=0)
    rms_g: float | None = Field(default=None, ge=0)
    ts: datetime
