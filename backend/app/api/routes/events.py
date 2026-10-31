"""Event endpoints per ARCHITECTURE.md §3.4 and §3.5."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.db.models import Event, EventStatus, User
from app.db.repositories.events import get_event_by_id, list_events_by_machine
from app.db.repositories.machines import get_machine_by_id
from app.errors import NotFoundError
from app.logging import get_logger
from app.schemas.call import CallAttemptOut
from app.schemas.diagnosis import Diagnosis
from app.schemas.event import DecisionIn, EventDetail, EventSummary
from app.schemas.pagination import Page
from app.schemas.telemetry import BaselineIn, PeakIn
from app.services.events_bus import publish_event_updated
from app.services.state_machine import apply_transition, assert_can_decide

router = APIRouter(tags=["events"])
logger = get_logger("events_route")


def _to_event_detail(event: Event) -> EventDetail:
    """Map DB Event model to EventDetail schema."""
    attempts: list[CallAttemptOut] = [
        CallAttemptOut(
            id=a.id,
            attempt_no=a.attempt_no,
            state=a.state,
            extracted_decision=a.extracted_decision,  # type: ignore[arg-type]
            started_at=a.started_at,
            ended_at=a.ended_at,
        )
        for a in (event.call_attempts or [])
    ]
    diag: Diagnosis | None = None
    if event.diagnosis and isinstance(event.diagnosis, dict):
        try:
            diag = Diagnosis.model_validate(event.diagnosis)
        except Exception:
            diag = None

    peaks = [
        PeakIn(freq_hz=p.get("freq_hz", 0.0), amp_g=p.get("amp_g", 0.0))
        if isinstance(p, dict)
        else p
        for p in (event.peaks or [])
    ]

    return EventDetail(
        id=event.id,
        machine_id=event.machine_id,
        status=event.status,
        severity=event.severity,  # type: ignore[arg-type]
        ts=event.ts,
        received_at=event.received_at,
        rms_g=event.rms_g,
        baseline=BaselineIn(mean=event.baseline_mean, std=event.baseline_std),
        z_score=event.z_score,
        peaks=peaks,
        hints=list(event.hints or []),
        diagnosis=diag,
        diagnosis_source=event.diagnosis_source,  # type: ignore[arg-type]
        decision=event.decision,  # type: ignore[arg-type]
        decided_at=event.decided_at,
        call_attempts=attempts,
    )


def _to_event_summary(event: Event) -> EventSummary:
    """Map DB Event model to EventSummary schema."""
    return EventSummary(
        id=event.id,
        machine_id=event.machine_id,
        status=event.status,
        severity=event.severity,  # type: ignore[arg-type]
        rms_g=event.rms_g,
        z_score=event.z_score,
        decision=event.decision,  # type: ignore[arg-type]
        created_at=event.created_at,
    )


@router.get("/v1/events", response_model=Page[EventSummary])
async def list_events(
    status: EventStatus | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Page[EventSummary]:
    """List recent events across all machines owned by the caller."""
    from app.db.repositories.events import list_events_by_machine_ids
    from app.db.repositories.machines import list_machines_by_owner

    machines = await list_machines_by_owner(session, owner_id=current_user.id, limit=200)
    if not machines:
        return Page[EventSummary](items=[], next_cursor=None)

    machine_ids = [m.id for m in machines]
    events = await list_events_by_machine_ids(
        session=session,
        machine_ids=machine_ids,
        status=status,
        limit=limit + 1,
        cursor=cursor,
    )

    has_more = len(events) > limit
    items = events[:limit]
    next_cursor = items[-1].id if (has_more and items) else None

    return Page[EventSummary](
        items=[_to_event_summary(e) for e in items],
        next_cursor=next_cursor,
    )


@router.get("/v1/machines/{machine_id}/events", response_model=Page[EventSummary])
async def list_machine_events(
    machine_id: str,
    status: EventStatus | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Page[EventSummary]:
    """List alert events for a machine scoped strictly by machine owner."""
    machine = await get_machine_by_id(session, machine_id=machine_id, owner_id=current_user.id)
    if not machine:
        raise NotFoundError("Machine not found.")

    events = await list_events_by_machine(
        session=session,
        machine_id=machine_id,
        status=status,
        limit=limit + 1,
        cursor=cursor,
    )

    has_more = len(events) > limit
    items = events[:limit]
    next_cursor = items[-1].id if (has_more and items) else None

    return Page[EventSummary](
        items=[_to_event_summary(e) for e in items],
        next_cursor=next_cursor,
    )


@router.get("/v1/events/{event_id}", response_model=EventDetail)
async def get_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> EventDetail:
    """Get full event detail scoped to machine owner."""
    event = await get_event_by_id(session, event_id=event_id)
    if not event:
        raise NotFoundError("Event not found.")

    machine = await get_machine_by_id(
        session, machine_id=event.machine_id, owner_id=current_user.id
    )
    if not machine:
        raise NotFoundError("Event not found.")

    return _to_event_detail(event)


@router.patch("/v1/events/{event_id}/decision", response_model=EventDetail)
async def record_event_decision(
    event_id: str,
    payload: DecisionIn,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> EventDetail:
    """Record or update a supervisor decision on an event."""
    event = await get_event_by_id(session, event_id=event_id)
    if not event:
        raise NotFoundError("Event not found.")

    machine = await get_machine_by_id(
        session, machine_id=event.machine_id, owner_id=current_user.id
    )
    if not machine:
        raise NotFoundError("Event not found.")

    # 1. Assert event is allowed to receive a decision (not FAILED)
    assert_can_decide(event.status)

    target_status = EventStatus[payload.decision]

    # 2. Apply state transition with SELECT FOR UPDATE and audit log
    updated_event = await apply_transition(
        session=session,
        event_id=event_id,
        to_status=target_status,
        actor=current_user.id,
        reason=payload.note,
        data={"decision": payload.decision, "note": payload.note},
    )
    await session.commit()

    # 3. Publish live update
    await publish_event_updated(
        event_id=event_id,
        machine_id=machine.id,
        status=target_status.value,
        owner_id=current_user.id,
    )

    # Re-fetch event with call attempts loaded
    fresh_event = await get_event_by_id(session, event_id=event_id)
    return _to_event_detail(fresh_event or updated_event)
