"""Machine schemas per ARCHITECTURE.md §3.5."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class MachineCreate(BaseModel):
    """Payload to register a new machine."""

    name: str = Field(min_length=1, max_length=100)
    machine_type: str = Field(min_length=1, max_length=50)
    model: str | None = Field(default=None, max_length=100)
    rated_rpm: float | None = Field(default=None, ge=0, le=100000)
    supervisor_name: str | None = Field(default=None, max_length=100)
    supervisor_phone: str = Field(pattern=r"^\+[1-9]\d{1,14}$")
    backup_phone: str | None = Field(default=None, pattern=r"^\+[1-9]\d{1,14}$")
    language: str = Field(default="en", max_length=10)
    factory_id: str | None = Field(
        default=None, pattern=r"^fac_[0-9A-HJKMNP-TV-Z]{26}$", description="Associated factory ID"
    )


class MachineUpdate(BaseModel):
    """Payload to update machine details."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    supervisor_name: str | None = Field(default=None, max_length=100)
    supervisor_phone: str | None = Field(default=None, pattern=r"^\+[1-9]\d{1,14}$")
    backup_phone: str | None = Field(default=None, pattern=r"^\+[1-9]\d{1,14}$")
    language: str | None = Field(default=None, max_length=10)


class MachineOut(BaseModel):
    """Machine detail response."""

    id: str = Field(pattern=r"^mch_[0-9A-HJKMNP-TV-Z]{26}$")
    name: str
    machine_type: str
    model: str | None = None
    rated_rpm: float | None = None
    supervisor_name: str | None = None
    supervisor_phone: str
    backup_phone: str | None = None
    language: str
    status: Literal["LEARNING", "HEALTHY", "ALERT", "OFFLINE"]
    device_online: bool
    last_seen_at: datetime | None = None
    created_at: datetime
    open_alerts: int = 0
    factory_id: str | None = None
