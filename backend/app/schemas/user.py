"""User profile schemas (Added in run 2)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class UserOut(BaseModel):
    """User profile response with onboarding state."""

    id: str = Field(pattern=r"^usr_[0-9A-HJKMNP-TV-Z]{26}$")
    email: str
    full_name: str | None = None
    phone: str | None = None
    language: str = "en"
    role: str
    onboarding_completed: bool
    onboarding_step: int
    created_at: datetime


class UserUpdateIn(BaseModel):
    """Update user personal details."""

    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(
        default=None,
        pattern=r"^\+[1-9]\d{1,14}$",
        description="E.164 international phone number format (e.g. +919876543210)",
    )
    language: Literal["en", "hi"] | None = None
