"""Unit tests for diagnosis service retry and fallback logic per ARCHITECTURE.md §4.3."""

import json
from datetime import UTC, datetime

import pytest

from app.db.models import Event, EventStatus, Machine
from app.schemas.diagnosis import Diagnosis
from app.services.diagnosis import generate_fallback_diagnosis, run_diagnosis
from app.services.rag import RetrievedChunk


class FakeLLMClient:
    """Fake LLM client simulating success, retry, and double failure."""

    def __init__(self, responses: list[str | Exception]) -> None:
        self.responses = list(responses)
        self.call_count = 0
        self.recorded_messages: list[list[dict[str, str]]] = []

    async def complete(self, messages: list[dict[str, str]], **kwargs: object) -> str:
        self.recorded_messages.append(messages)
        if self.call_count >= len(self.responses):
            raise RuntimeError("Exhausted fake responses")
        resp = self.responses[self.call_count]
        self.call_count += 1
        if isinstance(resp, Exception):
            raise resp
        return resp


@pytest.fixture
def sample_machine() -> Machine:
    return Machine(
        id="mch_01HZX3K2M9V4Q8R7T1Y6N0P5CB",
        owner_id="usr_01HZX3K2M9V4Q8R7T1Y6N0P5CB",
        name="Lathe 1",
        machine_type="lathe",
        model="Ace Micromatic",
        rated_rpm=1465.0,
        supervisor_phone="+919876543210",
        language="en",
    )


@pytest.fixture
def sample_event() -> Event:
    return Event(
        id="evt_01HZX3K2M9V4Q8R7T1Y6N0P5CB",
        machine_id="mch_01HZX3K2M9V4Q8R7T1Y6N0P5CB",
        status=EventStatus.ANOMALY_DETECTED,
        rms_g=0.84,
        z_score=21.0,
        baseline_mean=0.21,
        baseline_std=0.03,
        peaks=[{"freq_hz": 24.4, "amp_g": 0.52}],
        hints=["1x dominant: imbalance"],
        ts=datetime.now(UTC),
        seq=1,
    )


def test_generate_fallback_diagnosis() -> None:
    """Ensure fallback diagnosis produces valid Diagnosis schema with hints."""
    hints = ["1x dominant: imbalance", "2x peak: misalignment"]
    diagnosis = generate_fallback_diagnosis("Lathe 1", 0.84, 21.0, hints)
    assert isinstance(diagnosis, Diagnosis)
    assert diagnosis.severity == "HIGH"
    assert len(diagnosis.probable_causes) >= 1
    assert "Lathe 1" in diagnosis.voice_summary


@pytest.mark.asyncio
async def test_run_diagnosis_success_first_try(
    sample_machine: Machine, sample_event: Event
) -> None:
    """Verify diagnosis succeeds on the first attempt when valid JSON is returned."""
    valid_payload = {
        "probable_causes": [
            {
                "cause": "Spindle bearing wear",
                "confidence": 0.85,
                "evidence": "High 1x peak",
                "manual_ref": "p.14",
            }
        ],
        "severity": "HIGH",
        "recommended_action": "Inspect spindle bearings.",
        "safe_to_run_until": "end_of_shift",
        "voice_summary": "Lathe 1 spindle bearing wear detected.",
    }
    client = FakeLLMClient([json.dumps(valid_payload)])
    chunks = [
        RetrievedChunk(
            manual_id="man_01",
            machine_id=sample_machine.id,
            page=14,
            chunk_index=0,
            content="Spindle bearings require periodic lubrication.",
        )
    ]

    diag, source = await run_diagnosis(
        sample_machine,
        sample_event,
        ["1x dominant: imbalance"],
        chunks,
        llm_client=client,
    )

    assert source == "llm"
    assert client.call_count == 1
    assert diag.probable_causes[0].cause == "Spindle bearing wear"


@pytest.mark.asyncio
async def test_run_diagnosis_retry_success(sample_machine: Machine, sample_event: Event) -> None:
    """Verify diagnosis retries once on invalid JSON and succeeds on the second attempt."""
    valid_payload = {
        "probable_causes": [
            {
                "cause": "Shaft misalignment",
                "confidence": 0.78,
                "evidence": "2x peak observed",
                "manual_ref": None,
            }
        ],
        "severity": "MEDIUM",
        "recommended_action": "Realign motor coupling.",
        "safe_to_run_until": "24h",
        "voice_summary": "Lathe 1 misalignment detected.",
    }
    client = FakeLLMClient(
        [
            "Invalid non-JSON response from LLM",
            json.dumps(valid_payload),
        ]
    )

    diag, source = await run_diagnosis(
        sample_machine,
        sample_event,
        ["2x peak: misalignment"],
        [],
        llm_client=client,
    )

    assert source == "llm"
    assert client.call_count == 2
    assert diag.probable_causes[0].cause == "Shaft misalignment"


@pytest.mark.asyncio
async def test_run_diagnosis_double_failure_fallback(
    sample_machine: Machine, sample_event: Event
) -> None:
    """Verify diagnosis falls back to rule-based diagnosis if retry also fails."""
    client = FakeLLMClient(
        [
            "Non-JSON first try",
            "Non-JSON second try",
        ]
    )

    diag, source = await run_diagnosis(
        sample_machine,
        sample_event,
        ["1x dominant: imbalance"],
        [],
        llm_client=client,
    )

    assert source == "fallback"
    assert client.call_count == 2
    assert isinstance(diag, Diagnosis)
    assert any("unbalance" in c.cause.lower() for c in diag.probable_causes)
