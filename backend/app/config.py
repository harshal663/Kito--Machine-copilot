"""Application configuration using pydantic-settings."""

from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration settings."""

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[2] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_ENV: str = "development"
    MOCK_EXTERNALS: bool = True
    DATABASE_URL: str = "postgresql+asyncpg://copilot:copilot@localhost:5432/copilot"
    DATABASE_URL_TEST: str = "postgresql+asyncpg://copilot:copilot@localhost:5432/copilot_test"
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET: str = "change-me-to-32-plus-random-bytes"
    JWT_EXPIRES_HOURS: int = 12
    CORS_ORIGINS: str = "http://localhost:3000"
    UPLOAD_DIR: str = "./uploads"
    LOG_LEVEL: str = "INFO"
    EMBEDDING_BACKEND: Literal["hash", "local"] = "hash"
    LLM_BASE_URL: str = "https://api.groq.com/openai/v1"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "llama-3.1-8b-instant"
    MOCK_LLM_MODE: Literal["valid", "invalid", "timeout"] = "valid"
    BOLNA_BASE_URL: str = ""
    BOLNA_API_KEY: str = ""
    BOLNA_AGENT_ID: str = ""
    BOLNA_WEBHOOK_SECRET: str = "change-me"
    BOLNA_SIGNATURE_HEADER: str = "X-Bolna-Signature"
    NOTIFY_PROVIDER: Literal["mock", "fake", "twilio"] = "fake"
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""
    RETRY_DELAY_S: int = 300
    MAX_CALL_ATTEMPTS: int = 2
    DEVICE_TELEMETRY_RATE_PER_MIN: int = 6
    MACHINE_DAILY_CALL_CAP: int = 5
    COOLDOWN_S: int = 1800
    NEXT_PUBLIC_API_BASE_URL: str = "http://localhost:8000"

    @property
    def cors_origins_list(self) -> list[str]:
        """Return list of allowed CORS origins."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_non_mock_keys(self) -> "Settings":
        """Fail fast if required external keys are missing when MOCK_EXTERNALS=False."""
        if not self.MOCK_EXTERNALS:
            missing: list[str] = []
            if not self.LLM_API_KEY:
                missing.append("LLM_API_KEY")
            if not self.BOLNA_API_KEY:
                missing.append("BOLNA_API_KEY")
            if not self.BOLNA_AGENT_ID:
                missing.append("BOLNA_AGENT_ID")
            if self.NOTIFY_PROVIDER == "twilio":
                if not self.TWILIO_ACCOUNT_SID:
                    missing.append("TWILIO_ACCOUNT_SID")
                if not self.TWILIO_AUTH_TOKEN:
                    missing.append("TWILIO_AUTH_TOKEN")
                if not self.TWILIO_FROM_NUMBER:
                    missing.append("TWILIO_FROM_NUMBER")

            if missing:
                raise ValueError(
                    f"MOCK_EXTERNALS is false but required keys are missing: {', '.join(missing)}"
                )
        return self


settings = Settings()
