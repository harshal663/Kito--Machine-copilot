"""LLM diagnosis contract per ARCHITECTURE.md §3.5."""

from typing import Literal

from pydantic import BaseModel, Field


class Cause(BaseModel):
    """Diagnosed probable cause with confidence and citation."""

    cause: str = Field(max_length=120)
    confidence: float = Field(ge=0, le=1)
    evidence: str = Field(max_length=300)
    manual_ref: str | None = None


class Diagnosis(BaseModel):
    """Ranked diagnosis payload produced by LLM or fallback rules."""

    probable_causes: list[Cause] = Field(min_length=1, max_length=3)
    severity: Literal["LOW", "MEDIUM", "HIGH"]
    recommended_action: str = Field(max_length=300)
    safe_to_run_until: Literal["immediate", "end_of_shift", "24h", "unknown"]
    voice_summary: str = Field(max_length=240)
