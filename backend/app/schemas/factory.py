"""Factory schemas (Added in run 2)."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class FactoryIn(BaseModel):
    """Factory creation or replacement payload."""

    name: str = Field(min_length=1, max_length=120)
    industry: str = Field(min_length=1, max_length=100)
    address_line: str = Field(min_length=1, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    pincode: str = Field(pattern=r"^[1-9][0-9]{5}$", description="6-digit Indian PIN code")
    employee_band: str = Field(min_length=1, max_length=50)
    gstin: str | None = Field(
        default=None,
        description="15-character GSTIN format if provided",
    )

    @field_validator("gstin")
    @classmethod
    def validate_gstin(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v_clean = v.strip().upper()
        if not v_clean:
            return None
        import re

        pattern = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
        if not re.match(pattern, v_clean):
            raise ValueError("Invalid GSTIN format (must be 15 characters, e.g. 06AAAAA0000A1Z5)")
        return v_clean


class FactoryOut(BaseModel):
    """Factory details response."""

    id: str = Field(pattern=r"^fac_[0-9A-HJKMNP-TV-Z]{26}$")
    owner_id: str = Field(pattern=r"^usr_[0-9A-HJKMNP-TV-Z]{26}$")
    name: str
    industry: str
    address_line: str
    city: str
    state: str
    pincode: str
    employee_band: str
    gstin: str | None = None
    created_at: datetime
    updated_at: datetime
