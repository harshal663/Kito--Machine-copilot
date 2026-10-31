"""Bolna voice provider adapter per ARCHITECTURE.md §3.5 and §6.4."""

import json
from typing import Any, Protocol

import httpx
import redis.asyncio as aioredis

from app.api.deps import get_redis_pool
from app.config import settings
from app.errors import VoiceProviderError
from app.logging import get_logger
from app.schemas.call import CallResult
from app.security import verify_hmac_signature

logger = get_logger("bolna_client")


class VoiceClient(Protocol):
    """Protocol for outbound voice call providers."""

    async def start_call(
        self,
        event_id: str,
        attempt_id: str,
        phone_number: str,
        machine_name: str,
        voice_summary: str,
        language: str = "en",
        extra_vars: dict[str, Any] | None = None,
    ) -> str:
        """Initiate an outbound voice call and return the provider call ID."""
        ...


class BolnaClient:
    """Production Bolna voice adapter."""

    def __init__(
        self,
        base_url: str = settings.BOLNA_BASE_URL,
        api_key: str = settings.BOLNA_API_KEY,
        agent_id: str = settings.BOLNA_AGENT_ID,
        timeout_s: float = 15.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.agent_id = agent_id
        self.timeout_s = timeout_s

    async def start_call(
        self,
        event_id: str,
        attempt_id: str,
        phone_number: str,
        machine_name: str,
        voice_summary: str,
        language: str = "en",
        extra_vars: dict[str, Any] | None = None,
    ) -> str:
        """Call Bolna API to trigger an outbound phone call."""
        # VERIFY_WITH_BOLNA_DOCS: outbound call trigger endpoint
        url = f"{self.base_url}/call"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        # VERIFY_WITH_BOLNA_DOCS: payload variables and user_data context structure
        payload: dict[str, Any] = {
            "agent_id": self.agent_id,
            "recipient_phone_number": phone_number,
            "user_data": {
                "event_id": event_id,
                "attempt_id": attempt_id,
                "machine_name": machine_name,
                "voice_summary": voice_summary,
                "language": language,
                **(extra_vars or {}),
            },
        }

        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            try:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                call_id: str = data.get("call_id") or data.get("id") or f"bolna_{attempt_id}"
                return call_id
            except Exception as exc:
                logger.error("bolna_call_failed", error=str(exc), attempt_id=attempt_id)
                raise VoiceProviderError("Failed to initiate call via Bolna") from exc


class MockVoiceProvider:
    """Mock voice provider for testing and offline scenarios."""

    def __init__(self) -> None:
        self.recorded_calls: list[dict[str, Any]] = []

    async def start_call(
        self,
        event_id: str,
        attempt_id: str,
        phone_number: str,
        machine_name: str,
        voice_summary: str,
        language: str = "en",
        extra_vars: dict[str, Any] | None = None,
    ) -> str:
        """Record outbound call in memory and in Redis list mock:calls."""
        provider_call_id = f"bolna_call_{attempt_id}"
        record = {
            "event_id": event_id,
            "attempt_id": attempt_id,
            "provider_call_id": provider_call_id,
            "phone_number": phone_number,
            "machine_name": machine_name,
            "voice_summary": voice_summary,
            "language": language,
            "extra_vars": extra_vars or {},
        }
        self.recorded_calls.append(record)
        logger.info(
            "mock_voice_call_initiated",
            attempt_id=attempt_id,
            event_id=event_id,
            to=phone_number,
        )

        try:
            redis_client = aioredis.Redis(connection_pool=get_redis_pool())
            await redis_client.rpush("mock:calls", json.dumps(record))  # type: ignore[misc]
        except Exception as exc:
            logger.warning("mock_calls_redis_push_failed", error=str(exc))

        return provider_call_id


_voice_client: VoiceClient | None = None


def get_voice_client() -> VoiceClient:
    """Get singleton voice client instance."""
    global _voice_client
    if _voice_client is None:
        _voice_client = MockVoiceProvider() if settings.MOCK_EXTERNALS else BolnaClient()
    return _voice_client


def verify_bolna_signature(raw_body: bytes, signature_header: str | None) -> bool:
    """Verify incoming Bolna webhook HMAC signature over raw body."""
    if not signature_header:
        return False
    return verify_hmac_signature(
        raw_body=raw_body,
        signature=signature_header,
        secret=settings.BOLNA_WEBHOOK_SECRET,
    )


def normalize_bolna_webhook(body: dict[str, Any]) -> CallResult:
    """Normalize vendor-specific webhook payload into internal CallResult schema."""
    user_data = body.get("user_data", {})
    event_id = user_data.get("event_id") or body.get("event_id", "")
    attempt_id = user_data.get("attempt_id") or body.get("attempt_id", "")
    provider_call_id = body.get("call_id") or body.get("id") or f"bolna_{attempt_id}"

    # Status mapping
    # VERIFY_WITH_BOLNA_DOCS: raw call status strings
    raw_status = str(body.get("status", "")).lower()
    if raw_status in ("completed", "answered_and_completed"):
        state = "COMPLETED"
    elif raw_status in ("no-answer", "no_answer", "busy", "cancelled"):
        state = "NO_ANSWER"
    elif raw_status in ("failed", "error"):
        state = "FAILED"
    else:
        state = "ANSWERED"

    transcript = body.get("transcript")
    duration_s = body.get("duration")

    # Decision extraction
    extracted_data = body.get("extracted_data") or {}
    raw_decision = extracted_data.get("decision") or body.get("decision")
    decision = None
    if raw_decision:
        dec_upper = str(raw_decision).upper().strip()
        if dec_upper in ("ACKNOWLEDGED", "INSPECTION_SCHEDULED", "SHUTDOWN_REQUESTED"):
            decision = dec_upper

    # Fallback keyword extraction from transcript if decision was not structured
    if not decision and transcript:
        lower_t = transcript.lower()
        if "shutdown" in lower_t or "stop machine" in lower_t:
            decision = "SHUTDOWN_REQUESTED"
        elif "inspect" in lower_t or "schedule" in lower_t:
            decision = "INSPECTION_SCHEDULED"
        elif "acknowledge" in lower_t or "ok" in lower_t or "noted" in lower_t:
            decision = "ACKNOWLEDGED"

    return CallResult(
        event_id=event_id,
        attempt_id=attempt_id,
        provider_call_id=provider_call_id,
        state=state,  # type: ignore[arg-type]
        transcript=transcript,
        extracted_decision=decision,  # type: ignore[arg-type]
        duration_s=int(duration_s) if duration_s is not None else None,
    )
