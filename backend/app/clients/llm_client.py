"""LLM client interface and implementations per ARCHITECTURE.md §4.3 and §6.4."""

import json
from typing import Any, Protocol

import httpx

from app.config import settings
from app.errors import LLMUnavailableError
from app.logging import get_logger

logger = get_logger("llm_client")


class LLMClient(Protocol):
    """Protocol for LLM chat completion clients."""

    async def complete(self, messages: list[dict[str, str]], **kwargs: Any) -> str:
        """Send chat messages and return the raw string response."""
        ...


class OpenAILLMClient:
    """Async OpenAI-compatible chat completion client (Groq, Together, Fireworks)."""

    def __init__(
        self,
        base_url: str = settings.LLM_BASE_URL,
        api_key: str = settings.LLM_API_KEY,
        model: str = settings.LLM_MODEL,
        timeout_s: float = 20.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout_s = timeout_s

    async def complete(self, messages: list[dict[str, str]], **kwargs: Any) -> str:
        """Execute chat completion request over HTTP."""
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            **kwargs,
        }

        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            try:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                content: str = data["choices"][0]["message"]["content"]
                return content
            except httpx.TimeoutException as exc:
                logger.error("llm_request_timeout", error=str(exc))
                raise LLMUnavailableError("LLM request timed out after 20 seconds") from exc
            except httpx.HTTPStatusError as exc:
                logger.error(
                    "llm_http_error",
                    status_code=exc.response.status_code,
                    text=exc.response.text,
                )
                raise LLMUnavailableError(f"LLM returned HTTP {exc.response.status_code}") from exc
            except Exception as exc:
                logger.error("llm_request_failed", error=str(exc))
                raise LLMUnavailableError("Failed to communicate with LLM provider") from exc


class MockLLMClient:
    """Deterministic mock LLM client for tests and offline development."""

    def __init__(self, mode: str | None = None) -> None:
        self.mode = mode or settings.MOCK_LLM_MODE

    async def complete(self, messages: list[dict[str, str]], **kwargs: Any) -> str:
        """Return deterministic JSON or simulate failure based on MOCK_LLM_MODE."""
        current_mode = self.mode

        if current_mode == "timeout":
            raise LLMUnavailableError("Mock LLM simulated timeout")

        if current_mode == "invalid":
            return "This is invalid non-JSON output from the LLM"

        # Check if the prompt has context we can echo in evidence
        user_msg = ""
        for m in messages:
            if m.get("role") == "user":
                user_msg = m.get("content", "")

        ref = "p.14" if "manual" in user_msg.lower() or "page" in user_msg.lower() else None

        valid_diagnosis = {
            "probable_causes": [
                {
                    "cause": "Spindle bearing wear",
                    "confidence": 0.82,
                    "evidence": "Elevated 1x peak with broadband vibration rise",
                    "manual_ref": ref,
                }
            ],
            "severity": "HIGH",
            "recommended_action": "Schedule bearing inspection before next batch.",
            "safe_to_run_until": "end_of_shift",
            "voice_summary": "Vibration is four times normal, likely spindle bearing wear.",
        }
        return json.dumps(valid_diagnosis)


def get_llm_client() -> LLMClient:
    """Get configured LLM client instance."""
    if settings.MOCK_EXTERNALS:
        return MockLLMClient()
    return OpenAILLMClient()
