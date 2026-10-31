"""Onboarding completion schemas (Added in run 2)."""

from pydantic import BaseModel


class OnboardingCompleteIn(BaseModel):
    """Payload to complete the onboarding process."""

    machines_skipped: bool = False

