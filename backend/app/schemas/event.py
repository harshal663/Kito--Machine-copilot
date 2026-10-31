"""Event schemas per ARCHITECTURE.md §3.5."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.db.models import EventStatus
from app.schemas.call import CallAttemptOut
from app.schemas.diagnosis import Diagnosis
from app.schemas.telemetry import BaselineIn, PeakIn


class EventSummary(BaseModel):
    """Event summary for machine event list views."""

    id: str = Field(pattern=r"^evt_[0-9A-HJKMNP-TV-Z]{26}$")
    machine_id: str = Field(pattern=r"^mch_[0-9A-HJKMNP-TV-Z]{26}$")
    status: EventStatus
    severity: Literal["LOW", "MEDIUM", "HIGH"] | None = None
    rms_g: float
    z_score: float
    decision: Literal["ACKNOWLEDGED", "INSPECTION_SCHEDULED", "SHUTDOWN_REQUESTED"] | None = None
    created_at: datetime


class EventDetail(BaseModel):
    """Detailed event view including diagnosis, evidence, and call attempts."""

    id: str = Field(pattern=r"^evt_[0-9A-HJKMNP-TV-Z]{26}$")
    machine_id: str = Field(pattern=r"^mch_[0-9A-HJKMNP-TV-Z]{26}$")
    status: EventStatus
    severity: Literal["LOW", "MEDIUM", "HIGH"] | None = None
    ts: datetime
    received_at: datetime
    rms_g: float
    baseline: BaselineIn
    z_score: float
    peaks: list[PeakIn] = Field(default_factory=list)
    hints: list[str] = Field(default_factory=list)
    diagnosis: Diagnosis | None = None
    diagnosis_source: Literal["llm", "fallback"] | None = None
    decision: Literal["ACKNOWLEDGED", "INSPECTION_SCHEDULED", "SHUTDOWN_REQUESTED"] | None = None
    decided_at: datetime | None = None
    call_attempts: list[CallAttemptOut] = Field(default_factory=list)


class DecisionIn(BaseModel):
    """Payload to record or change a decision from dashboard or webhook."""

    decision: Literal["ACKNOWLEDGED", "INSPECTION_SCHEDULED", "SHUTDOWN_REQUESTED"]
    note: str | None = Field(default=None, max_length=500)
