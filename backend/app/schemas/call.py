"""Call schemas per ARCHITECTURE.md §3.5."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CallResult(BaseModel):
    """Normalized call result from voice provider webhook."""

    event_id: str = Field(pattern=r"^evt_[0-9A-HJKMNP-TV-Z]{26}$")
    attempt_id: str = Field(pattern=r"^cal_[0-9A-HJKMNP-TV-Z]{26}$")
    provider_call_id: str
    state: Literal["ANSWERED", "COMPLETED", "NO_ANSWER", "FAILED"]
    transcript: str | None = None
    extracted_decision: (
        Literal["ACKNOWLEDGED", "INSPECTION_SCHEDULED", "SHUTDOWN_REQUESTED"] | None
    ) = None
    duration_s: int | None = None


class CallAttemptOut(BaseModel):
    """Call attempt details returned in event views."""

    id: str = Field(pattern=r"^cal_[0-9A-HJKMNP-TV-Z]{26}$")
    attempt_no: int
    state: str
    extracted_decision: (
        Literal["ACKNOWLEDGED", "INSPECTION_SCHEDULED", "SHUTDOWN_REQUESTED"] | None
    ) = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
