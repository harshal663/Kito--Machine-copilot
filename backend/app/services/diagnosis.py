"""Diagnosis service synthesizing telemetry, rule hints, and RAG chunks per ARCHITECTURE.md §4.3."""

import json
from typing import Literal

from pydantic import ValidationError

from app.clients.llm_client import LLMClient, get_llm_client
from app.db.models import Event, Machine
from app.logging import get_logger
from app.schemas.diagnosis import Cause, Diagnosis
from app.services.rag import RetrievedChunk

logger = get_logger("diagnosis_service")

SYSTEM_PROMPT = """You are an expert industrial reliability engineer and vibration analyst.
Analyze machine telemetry, FFT hints, and manual excerpts to diagnose anomaly root cause.
Output MUST be a valid JSON object matching this schema:
{
  "probable_causes": [
    {
      "cause": string (max 120 chars),
      "confidence": number between 0.0 and 1.0,
      "evidence": string (max 300 chars),
      "manual_ref": string or null (e.g. "p.14" or null)
    }
  ],
  "severity": "LOW" | "MEDIUM" | "HIGH",
  "recommended_action": string (max 300 chars),
  "safe_to_run_until": "immediate" | "end_of_shift" | "24h" | "unknown",
  "voice_summary": string (max 240 chars, concise plain text for a phone call)
}
Strict constraints:
1. Output valid JSON ONLY. No markdown formatting, no code fences.
2. Use only the provided evidence. If unsure, indicate low confidence and recommend inspection.
3. At most 3 probable causes, at least 1.
"""


def build_user_prompt(
    machine: Machine,
    event: Event,
    hints: list[str],
    chunks: list[RetrievedChunk],
) -> str:
    """Build formatted diagnostic prompt containing evidence and context."""
    rag_text = ""
    if chunks:
        rag_parts = [f"[Manual {c.manual_id} Page {c.page}]:\n{c.content}" for c in chunks]
        rag_text = "\n\n".join(rag_parts)
    else:
        rag_text = "No machine manual excerpts available."

    hints_text = "\n".join(f"- {h}" for h in hints) if hints else "None"

    return f"""Machine Information:
- ID: {machine.id}
- Name: {machine.name}
- Type: {machine.machine_type}
- Model: {machine.model or "Unknown"}
- Rated RPM: {machine.rated_rpm or "Unknown"}

Anomaly Telemetry:
- RMS: {event.rms_g} g
- Baseline: mean={event.baseline_mean} g, std={event.baseline_std} g
- Z-Score: {event.z_score}
- Spectral Peaks: {event.peaks}

Rule-based FFT Hints:
{hints_text}

Retrieved Manual Excerpts:
{rag_text}
"""


def generate_fallback_diagnosis(
    machine_name: str,
    rms_g: float,
    z_score: float,
    hints: list[str],
) -> Diagnosis:
    """Deterministic fallback diagnosis derived strictly from rule hints and RMS."""
    causes: list[Cause] = []
    for h in hints:
        if "imbalance" in h.lower():
            causes.append(
                Cause(
                    cause="Mechanical unbalance",
                    confidence=0.7,
                    evidence=h,
                    manual_ref=None,
                )
            )
        elif "misalignment" in h.lower():
            causes.append(
                Cause(
                    cause="Shaft misalignment",
                    confidence=0.7,
                    evidence=h,
                    manual_ref=None,
                )
            )
        elif "looseness" in h.lower():
            causes.append(
                Cause(
                    cause="Mechanical looseness",
                    confidence=0.7,
                    evidence=h,
                    manual_ref=None,
                )
            )
        elif "sub-synchronous" in h.lower():
            causes.append(
                Cause(
                    cause="Bearing cage wear or belt slip",
                    confidence=0.6,
                    evidence=h,
                    manual_ref=None,
                )
            )
        if len(causes) >= 3:
            break

    if not causes:
        causes.append(
            Cause(
                cause="Elevated vibration anomaly",
                confidence=0.5,
                evidence=f"RMS vibration {rms_g:.2f}g with z-score {z_score:.1f}",
                manual_ref=None,
            )
        )

    severity: Literal["LOW", "MEDIUM", "HIGH"]
    if z_score >= 10.0 or rms_g >= 1.0:
        severity = "HIGH"
    elif z_score >= 4.0:
        severity = "MEDIUM"
    else:
        severity = "LOW"

    safe_until: Literal["immediate", "end_of_shift", "24h", "unknown"]
    if severity == "HIGH":
        safe_until = "immediate"
    elif severity == "MEDIUM":
        safe_until = "end_of_shift"
    else:
        safe_until = "24h"

    primary = causes[0].cause
    voice_msg = (
        f"{machine_name} vibration elevated to {rms_g:.2f}g. Rule-based check suggests {primary}."
    )
    if len(voice_msg) > 240:
        voice_msg = voice_msg[:237] + "..."

    return Diagnosis(
        probable_causes=causes,
        severity=severity,
        recommended_action=f"Perform on-site vibration check and inspect for {primary.lower()}.",
        safe_to_run_until=safe_until,
        voice_summary=voice_msg,
    )


def _clean_json_str(raw: str) -> str:
    """Strip code fences if LLM wrapped output in markdown."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    return cleaned


async def run_diagnosis(
    machine: Machine,
    event: Event,
    hints: list[str],
    chunks: list[RetrievedChunk],
    llm_client: LLMClient | None = None,
) -> tuple[Diagnosis, Literal["llm", "fallback"]]:
    """Execute LLM diagnosis with single retry on validation error and rule-based fallback."""
    client = llm_client or get_llm_client()
    user_prompt = build_user_prompt(machine, event, hints, chunks)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    # Attempt 1
    raw_output = ""
    try:
        raw_output = await client.complete(messages)
        cleaned = _clean_json_str(raw_output)
        data = json.loads(cleaned)
        diagnosis = Diagnosis.model_validate(data)
        return diagnosis, "llm"
    except (json.JSONDecodeError, ValidationError) as exc:
        truncated = raw_output[:200]
        logger.warning(
            "llm_output_invalid_retrying",
            error=str(exc),
            raw_sample=truncated,
            event_id=event.id,
        )
    except Exception as exc:
        logger.error(
            "llm_call_failed_fallback",
            error=str(exc),
            event_id=event.id,
        )
        fallback = generate_fallback_diagnosis(machine.name, event.rms_g, event.z_score, hints)
        return fallback, "fallback"

    # Attempt 2 (Retry with correction prompt)
    messages.append({"role": "assistant", "content": raw_output[:500]})
    messages.append(
        {
            "role": "user",
            "content": (
                "Your previous response was invalid. Output MUST be valid JSON adhering "
                "strictly to the schema without any surrounding markdown or commentary."
            ),
        }
    )

    try:
        raw_output_retry = await client.complete(messages)
        cleaned_retry = _clean_json_str(raw_output_retry)
        data_retry = json.loads(cleaned_retry)
        diagnosis_retry = Diagnosis.model_validate(data_retry)
        return diagnosis_retry, "llm"
    except Exception as exc:
        truncated_retry = raw_output_retry[:200] if raw_output_retry else ""
        logger.error(
            "llm_retry_failed_using_fallback",
            error=str(exc),
            raw_sample=truncated_retry,
            event_id=event.id,
        )
        fallback = generate_fallback_diagnosis(machine.name, event.rms_g, event.z_score, hints)
        return fallback, "fallback"
