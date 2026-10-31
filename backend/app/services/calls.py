"""Voice call lifecycle and webhook processing per ARCHITECTURE.md §3.5 and §4.3."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.bolna import get_voice_client
from app.config import settings
from app.db.models import CallAttempt, Event, EventStatus, Machine
from app.db.repositories.call_attempts import (
    create_call_attempt,
    get_call_attempt_by_id,
)
from app.errors import NotFoundError
from app.ids import generate_id
from app.logging import get_logger
from app.schemas.call import CallResult
from app.services.events_bus import publish_event_updated
from app.services.state_machine import TERMINAL_STATES, apply_transition
from app.workers.queue import enqueue_job

logger = get_logger("calls_service")


async def start_event_call(
    session: AsyncSession,
    event_id: str,
    attempt_no: int = 1,
) -> CallAttempt:
    """Create a call_attempts record and initiate an outbound voice call."""
    event = await session.get(Event, event_id)
    if not event:
        raise NotFoundError(f"Event {event_id} not found")

    machine = await session.get(Machine, event.machine_id)
    if not machine:
        raise NotFoundError(f"Machine {event.machine_id} not found")

    attempt_id = generate_id("cal_")
    attempt = CallAttempt(
        id=attempt_id,
        event_id=event_id,
        attempt_no=attempt_no,
        to_phone=machine.supervisor_phone,
        state="QUEUED",
        started_at=datetime.now(UTC),
    )
    await create_call_attempt(session, attempt)
    await session.commit()

    voice_summary = ""
    if event.diagnosis and isinstance(event.diagnosis, dict):
        voice_summary = str(event.diagnosis.get("voice_summary", ""))
    if not voice_summary:
        voice_summary = f"Vibration anomaly on {machine.name}. Current RMS is {event.rms_g:.2f}g."

    voice_client = get_voice_client()
    try:
        provider_call_id = await voice_client.start_call(
            event_id=event_id,
            attempt_id=attempt_id,
            phone_number=machine.supervisor_phone,
            machine_name=machine.name,
            voice_summary=voice_summary,
            language=machine.language,
        )
        attempt.provider_call_id = provider_call_id
        attempt.state = "RINGING"
        await session.commit()
    except Exception as exc:
        logger.error("outbound_call_start_error", error=str(exc), attempt_id=attempt_id)
        attempt.state = "FAILED"
        await session.commit()
        raise

    return attempt


async def process_call_webhook(
    session: AsyncSession,
    result: CallResult,
) -> None:
    """Update call_attempt and apply event transition based on Bolna webhook."""
    attempt: CallAttempt | None = None
    if result.attempt_id:
        attempt = await get_call_attempt_by_id(session, result.attempt_id)

    if not attempt and result.event_id:
        stmt = (
            select(CallAttempt)
            .where(CallAttempt.event_id == result.event_id)
            .order_by(CallAttempt.attempt_no.desc())
        )
        attempt = (await session.execute(stmt)).scalars().first()

    attempt_no = 1
    if attempt:
        attempt_no = attempt.attempt_no
        attempt.state = result.state
        attempt.transcript = result.transcript
        attempt.extracted_decision = result.extracted_decision
        attempt.ended_at = datetime.now(UTC)
        await session.commit()

    event = await session.get(Event, result.event_id)
    if not event:
        logger.error("webhook_event_not_found", event_id=result.event_id)
        return

    if event.status in TERMINAL_STATES:
        logger.info("webhook_event_already_terminal", event_id=event.id, status=event.status.value)
        return

    machine = await session.get(Machine, event.machine_id)
    owner_id = machine.owner_id if machine else ""

    actor = f"voice_{result.attempt_id}" if result.attempt_id else "voice_provider"

    # Branch 1: Supervisor spoken decision
    if result.extracted_decision:
        decision_status = EventStatus[result.extracted_decision]
        await apply_transition(
            session=session,
            event_id=event.id,
            to_status=decision_status,
            actor=actor,
            reason="decision_spoken_on_call",
        )
        await session.commit()
        await publish_event_updated(event.id, event.machine_id, decision_status.value, owner_id)
        logger.info(
            "call_decision_applied",
            event_id=event.id,
            decision=result.extracted_decision,
        )
        return

    # Branch 2: No answer / busy / unavailable
    if result.state == "NO_ANSWER":
        await apply_transition(
            session=session,
            event_id=event.id,
            to_status=EventStatus.NO_ANSWER,
            actor=actor,
            reason="call_no_answer",
        )
        await session.commit()
        await publish_event_updated(
            event.id, event.machine_id, EventStatus.NO_ANSWER.value, owner_id
        )

        if attempt_no < settings.MAX_CALL_ATTEMPTS:
            logger.info("enqueuing_retry_call", event_id=event.id, attempt_no=attempt_no + 1)
            await enqueue_job(
                "retry_call",
                event.id,
                attempt_no + 1,
                _defer_by=settings.RETRY_DELAY_S,
            )
        else:
            logger.info("retries_exhausted_enqueuing_escalation", event_id=event.id)
            await enqueue_job("escalate", event.id)
        return

    # Branch 3: Completed or failed without explicit decision
    if result.state == "FAILED":
        if attempt_no < settings.MAX_CALL_ATTEMPTS:
            await apply_transition(
                session=session,
                event_id=event.id,
                to_status=EventStatus.NO_ANSWER,
                actor=actor,
                reason="call_provider_failed_retrying",
            )
            await session.commit()
            await enqueue_job(
                "retry_call",
                event.id,
                attempt_no + 1,
                _defer_by=settings.RETRY_DELAY_S,
            )
        else:
            await enqueue_job("escalate", event.id)
