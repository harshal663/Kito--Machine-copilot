"""Alerting service processing sensor anomaly reports per ARCHITECTURE.md §3.4 and §4.3."""

from datetime import UTC, datetime

import redis.asyncio as aioredis
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Device, Event, EventStatus, Machine, TrendPoint
from app.db.repositories.audit_log import record_audit_log
from app.db.repositories.events import create_event, get_event_by_device_seq
from app.db.repositories.trend_points import create_trend_point
from app.errors import ForbiddenError, RateLimitedError
from app.ids import generate_id
from app.schemas.telemetry import TelemetryAccepted, TelemetryIn
from app.services.cooldown import (
    acquire_cooldown,
    check_daily_call_cap,
    check_device_rate_limit,
    check_idempotency,
)
from app.services.events_bus import publish_event
from app.workers.queue import enqueue_job

logger = structlog.get_logger()


async def process_telemetry_report(
    session: AsyncSession,
    redis_client: aioredis.Redis,
    device: Device,
    payload: TelemetryIn,
) -> TelemetryAccepted:
    """Process incoming sensor telemetry report following the strict 7-step sequence."""
    # Step 1: Device key valid and bound to machine_id in body
    if device.machine_id != payload.machine_id:
        raise ForbiddenError(message="Device is not bound to specified machine.")

    machine = await session.get(Machine, payload.machine_id)
    if not machine:
        raise ForbiddenError(message="Bound machine does not exist.")

    # Step 2: Pydantic validation (already passed at router boundary)

    # Step 3: Rate limit ratelimit:device:{device_id}:{minute} <= 6
    is_rate_ok = await check_device_rate_limit(
        redis_client,
        device_id=device.id,
        rate_per_min=settings.DEVICE_TELEMETRY_RATE_PER_MIN,
    )
    if not is_rate_ok:
        raise RateLimitedError(message="Telemetry per-minute rate limit exceeded.")

    # Step 4: Idempotency check: SET idem:{device_id}:{seq} NX EX 86400
    is_new = await check_idempotency(redis_client, device_id=device.id, seq=payload.seq)
    if not is_new:
        existing_event = await get_event_by_device_seq(session, device.id, payload.seq)
        if existing_event:
            return TelemetryAccepted(status="accepted", event_id=existing_event.id)
        # If key existed in Redis but DB event not found, proceed or treat as suppressed

    # Step 5: Cooldown: SET cooldown:machine:{machine_id} NX EX 1800
    cooldown_acquired = await acquire_cooldown(
        redis_client,
        machine_id=payload.machine_id,
        cooldown_s=settings.COOLDOWN_S,
    )
    if not cooldown_acquired:
        # Suppressed by cooldown: record trend point only
        trend = TrendPoint(
            machine_id=payload.machine_id,
            ts=payload.ts,
            rms_g=payload.rms_g,
            source="alert_window",
        )
        await create_trend_point(session, trend)
        await session.commit()
        return TelemetryAccepted(status="suppressed", event_id=None)

    # Step 6: Daily cap: INCR calls:machine:{machine_id}:{yyyymmdd} <= 5
    is_under_cap = await check_daily_call_cap(
        redis_client,
        machine_id=payload.machine_id,
        cap=settings.MACHINE_DAILY_CALL_CAP,
    )
    if not is_under_cap:
        # Suppressed by daily cap: record trend point only
        trend = TrendPoint(
            machine_id=payload.machine_id,
            ts=payload.ts,
            rms_g=payload.rms_g,
            source="alert_window",
        )
        await create_trend_point(session, trend)
        await session.commit()
        return TelemetryAccepted(status="suppressed", event_id=None)

    # Step 7: Create Event, set machine ALERT, enqueue job, publish live update
    event_id = generate_id("evt_")
    now_utc = datetime.now(UTC)
    severity = "HIGH" if payload.z_score >= 10 else ("MEDIUM" if payload.z_score >= 5 else "LOW")

    event = Event(
        id=event_id,
        machine_id=payload.machine_id,
        device_id=device.id,
        status=EventStatus.ANOMALY_DETECTED,
        severity=severity,
        ts=payload.ts,
        received_at=now_utc,
        seq=payload.seq,
        rms_g=payload.rms_g,
        z_score=payload.z_score,
        baseline_mean=payload.baseline.mean,
        baseline_std=payload.baseline.std,
        peaks=[peak.model_dump() for peak in payload.peaks],
        rpm_est=payload.rpm_est,
    )
    await create_event(session, event)

    # Update machine status to ALERT
    machine.status = "ALERT"

    # Write trend point
    trend = TrendPoint(
        machine_id=payload.machine_id,
        ts=payload.ts,
        rms_g=payload.rms_g,
        source="alert_window",
    )
    await create_trend_point(session, trend)

    # Write audit log
    await record_audit_log(
        session=session,
        actor=device.id,
        action="event.created",
        entity_type="event",
        entity_id=event_id,
        data={"status": EventStatus.ANOMALY_DETECTED.value, "severity": severity},
    )

    await session.commit()

    # Enqueue background diagnosis job
    try:
        await enqueue_job("diagnose_and_call", event_id)
    except Exception as exc:
        # Enqueue failure shouldn't block accepted telemetry in testing if worker is off
        logger.warning("enqueue_diagnose_failed", event_id=event_id, error=str(exc))

    # Publish live SSE update
    await publish_event(
        redis_client=redis_client,
        event_name="event.updated",
        payload={
            "event_id": event_id,
            "machine_id": payload.machine_id,
            "status": EventStatus.ANOMALY_DETECTED.value,
            "updated_at": now_utc.isoformat(),
        },
        owner_id=machine.owner_id,
    )

    return TelemetryAccepted(status="accepted", event_id=event_id)
