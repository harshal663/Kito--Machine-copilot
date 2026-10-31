"""Authentication schemas."""

from pydantic import BaseModel, Field, field_validator


class LoginIn(BaseModel):
    """Dashboard login credentials."""

    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower().strip()


class RegisterIn(BaseModel):
    """Owner account registration (Added in run 2)."""

    email: str = Field(
        min_length=5,
        max_length=255,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        description="Valid email address, converted to lowercase",
    )
    password: str = Field(min_length=10, max_length=128, description="Minimum 10 characters")
    full_name: str = Field(min_length=1, max_length=120)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower().strip()


class TokenOut(BaseModel):
    """Bearer access token response."""

    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    role: str
