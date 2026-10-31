"""Background arq worker jobs per ARCHITECTURE.md §4.1 and §4.3."""

from typing import Any

import redis.asyncio as aioredis
from arq import Retry
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import get_redis_pool
from app.clients.bolna import get_voice_client
from app.db.models import Event, EventStatus, Machine
from app.db.session import async_session_factory
from app.ids import generate_id
from app.logging import get_logger
from app.services.calls import start_event_call
from app.services.diagnosis import run_diagnosis
from app.services.events_bus import publish_event_updated, publish_machine_updated
from app.services.manual_ingest import process_manual_file
from app.services.notifier import send_escalation_notification
from app.services.rag import retrieve_relevant_chunks
from app.services.state_machine import TERMINAL_STATES, apply_transition

logger = get_logger("worker_jobs")

RETRY_DELAYS = [10, 60, 300]


async def diagnose_and_call(ctx: dict[str, Any], event_id: str) -> None:
    """Asynchronous pipeline: retrieve manual chunks, call LLM, store diagnosis, and start call."""
    job_try: int = ctx.get("job_try", 1)
    session_maker = ctx.get("session_factory") or async_session_factory
    logger.info("diagnose_and_call_started", event_id=event_id, job_try=job_try)

    # 1. Load event and check idempotency / state
    async with session_maker() as session:
        event = await session.get(Event, event_id)
        if not event:
            logger.error("job_event_not_found", event_id=event_id)
            return

        if event.status in TERMINAL_STATES:
            logger.info("job_event_already_terminal", event_id=event_id, status=event.status.value)
            return

        # If already diagnosing or calling from a previous try, allow resume
        if event.status is EventStatus.ANOMALY_DETECTED:
            await apply_transition(
                session=session,
                event_id=event_id,
                to_status=EventStatus.DIAGNOSING,
                actor="system",
                reason="diagnosis_started",
            )
            await session.commit()
            # Refresh event
            await session.refresh(event)

        machine = await session.get(Machine, event.machine_id)
        if not machine:
            logger.error("job_machine_not_found", machine_id=event.machine_id)
            return

        hints: list[str] = list(event.hints) if event.hints else []
        query_text = f"vibration anomaly hints: {' '.join(hints)}"
        chunks = await retrieve_relevant_chunks(
            session=session,
            query_text=query_text,
            machine_id=event.machine_id,
            limit=4,
        )

    # 2. Database session is CLOSED before LLM call per STANDARDS §2.4
    try:
        diagnosis, source = await run_diagnosis(
            machine=machine,
            event=event,
            hints=hints,
            chunks=chunks,
        )
    except Exception as exc:
        logger.error("diagnosis_execution_exception", error=str(exc), event_id=event_id)
        if job_try >= 3:
            async with session_maker() as session:
                ev = await session.get(Event, event_id)
                if ev and ev.status not in TERMINAL_STATES:
                    ev.error_code = "LLM_UNAVAILABLE"
                    await apply_transition(
                        session=session,
                        event_id=event_id,
                        to_status=EventStatus.FAILED,
                        actor="system",
                        reason="diagnosis_failed_exhausted_retries",
                    )
                    await session.commit()
            return
        delay = RETRY_DELAYS[min(job_try - 1, len(RETRY_DELAYS) - 1)]
        raise Retry(defer=delay) from exc

    # 3. Re-open database session to persist diagnosis and transition to CALLING
    async with session_maker() as session:
        ev = await session.get(Event, event_id)
        if not ev:
            return
        if ev.status in TERMINAL_STATES:
            return

        ev.diagnosis = diagnosis.model_dump()
        ev.diagnosis_source = source
        ev.severity = diagnosis.severity

        await apply_transition(
            session=session,
            event_id=event_id,
            to_status=EventStatus.CALLING,
            actor="system",
            reason="diagnosis_stored_starting_call",
        )
        await session.commit()

        # 4. Initiate outbound voice call
        try:
            await start_event_call(session, event_id, attempt_no=1)
        except Exception as exc:
            logger.warning("voice_call_start_failed", error=str(exc), event_id=event_id)

    # 5. Publish live update
    try:
        await publish_event_updated(
            event_id=event_id,
            machine_id=event.machine_id,
            status=EventStatus.CALLING.value,
            owner_id=machine.owner_id,
        )
    except Exception as exc:
        logger.warning("event_bus_publish_failed", error=str(exc))


async def retry_call(ctx: dict[str, Any], event_id: str, attempt_no: int) -> None:
    """Retry outbound call after NO_ANSWER."""
    session_maker = ctx.get("session_factory") or async_session_factory
    async with session_maker() as session:
        event = await session.get(Event, event_id)
        if not event or event.status in TERMINAL_STATES:
            logger.info("retry_skipped_event_terminal", event_id=event_id)
            return

        # Transition NO_ANSWER -> RETRYING
        if event.status == EventStatus.NO_ANSWER:
            await apply_transition(
                session=session,
                event_id=event_id,
                to_status=EventStatus.RETRYING,
                actor="system",
                reason=f"scheduling_retry_attempt_{attempt_no}",
            )
            await session.commit()

        # Transition RETRYING -> CALLING
        await apply_transition(
            session=session,
            event_id=event_id,
            to_status=EventStatus.CALLING,
            actor="system",
            reason=f"starting_retry_attempt_{attempt_no}",
        )
        await session.commit()

        try:
            await start_event_call(session, event_id, attempt_no=attempt_no)
        except Exception as exc:
            logger.warning("retry_call_failed", error=str(exc), event_id=event_id)


async def escalate(ctx: dict[str, Any], event_id: str) -> None:
    """Escalate alert to backup phone via SMS after retries exhausted."""
    session_maker = ctx.get("session_factory") or async_session_factory
    async with session_maker() as session:
        await send_escalation_notification(session, event_id)


async def send_test_call(ctx: dict[str, Any], machine_id: str) -> None:
    """Outbound test call for onboarding verification."""
    session_maker = ctx.get("session_factory") or async_session_factory
    async with session_maker() as session:
        machine = await session.get(Machine, machine_id)
        if not machine:
            logger.error("test_call_machine_not_found", machine_id=machine_id)
            return

        voice_client = get_voice_client()
        summary = (
            f"This is a test call from Machine Copilot for {machine.name}. "
            f"Vibration monitoring system is functioning properly."
        )
        await voice_client.start_call(
            event_id="test_call",
            attempt_id=generate_id("cal_"),
            phone_number=machine.supervisor_phone,
            machine_name=machine.name,
            voice_summary=summary,
            language=machine.language,
        )


async def ingest_manual(ctx: dict[str, Any], manual_id: str) -> None:
    """Extract, chunk, embed, and store manual PDF."""
    session_maker = ctx.get("session_factory") or async_session_factory
    await process_manual_file(manual_id, session_factory=session_maker)


async def offline_sweep(ctx: dict[str, Any]) -> None:
    """Cron job: sweep machines to mark offline when device:seen expires."""
    session_maker = ctx.get("session_factory") or async_session_factory
    redis_client = aioredis.Redis(connection_pool=get_redis_pool())

    async with session_maker() as session:
        stmt = select(Machine).options(selectinload(Machine.device))
        machines = (await session.execute(stmt)).scalars().all()

        for m in machines:
            if not m.device:
                continue

            dev_id = m.device.id
            is_seen = await redis_client.exists(f"device:seen:{dev_id}")
            device_online = bool(is_seen)

            prev_status = m.status
            new_status = prev_status

            if not device_online:
                new_status = "OFFLINE"
            else:
                # Check open alerts
                open_alert_stmt = (
                    select(Event)
                    .where(
                        Event.machine_id == m.id,
                        Event.status.not_in(
                            [
                                EventStatus.ACKNOWLEDGED,
                                EventStatus.INSPECTION_SCHEDULED,
                                EventStatus.SHUTDOWN_REQUESTED,
                                EventStatus.FAILED,
                            ]
                        ),
                    )
                    .limit(1)
                )
                open_alert = (await session.execute(open_alert_stmt)).scalar_one_or_none()
                new_status = "ALERT" if open_alert else "HEALTHY"

            if new_status != prev_status:
                m.status = new_status
                await session.commit()
                await publish_machine_updated(
                    machine_id=m.id,
                    status=new_status,
                    device_online=device_online,
                    owner_id=m.owner_id,
                )
