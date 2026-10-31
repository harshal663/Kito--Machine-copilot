"""Event state machine and audit logging per ARCHITECTURE.md §5."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog, Event, EventStatus
from app.errors import InvalidStateTransitionError, NotFoundError

TERMINAL_DECISIONS: frozenset[EventStatus] = frozenset(
    {
        EventStatus.ACKNOWLEDGED,
        EventStatus.INSPECTION_SCHEDULED,
        EventStatus.SHUTDOWN_REQUESTED,
    }
)

TERMINAL_STATES: frozenset[EventStatus] = TERMINAL_DECISIONS | frozenset({EventStatus.FAILED})

VALID_TRANSITIONS: dict[EventStatus, set[EventStatus]] = {
    EventStatus.ANOMALY_DETECTED: {
        EventStatus.DIAGNOSING,
        EventStatus.FAILED,
        EventStatus.ACKNOWLEDGED,
        EventStatus.INSPECTION_SCHEDULED,
        EventStatus.SHUTDOWN_REQUESTED,
    },
    EventStatus.DIAGNOSING: {
        EventStatus.CALLING,
        EventStatus.FAILED,
        EventStatus.ACKNOWLEDGED,
        EventStatus.INSPECTION_SCHEDULED,
        EventStatus.SHUTDOWN_REQUESTED,
    },
    EventStatus.CALLING: {
        EventStatus.NO_ANSWER,
        EventStatus.ACKNOWLEDGED,
        EventStatus.INSPECTION_SCHEDULED,
        EventStatus.SHUTDOWN_REQUESTED,
        EventStatus.FAILED,
    },
    EventStatus.NO_ANSWER: {
        EventStatus.RETRYING,
        EventStatus.ESCALATED,
        EventStatus.FAILED,
        EventStatus.ACKNOWLEDGED,
        EventStatus.INSPECTION_SCHEDULED,
        EventStatus.SHUTDOWN_REQUESTED,
    },
    EventStatus.RETRYING: {
        EventStatus.CALLING,
        EventStatus.ESCALATED,
        EventStatus.FAILED,
        EventStatus.ACKNOWLEDGED,
        EventStatus.INSPECTION_SCHEDULED,
        EventStatus.SHUTDOWN_REQUESTED,
    },
    EventStatus.ESCALATED: {
        EventStatus.FAILED,
        EventStatus.ACKNOWLEDGED,
        EventStatus.INSPECTION_SCHEDULED,
        EventStatus.SHUTDOWN_REQUESTED,
    },
    EventStatus.ACKNOWLEDGED: {
        EventStatus.INSPECTION_SCHEDULED,
        EventStatus.SHUTDOWN_REQUESTED,
    },
    EventStatus.INSPECTION_SCHEDULED: {
        EventStatus.ACKNOWLEDGED,
        EventStatus.SHUTDOWN_REQUESTED,
    },
    EventStatus.SHUTDOWN_REQUESTED: {
        EventStatus.ACKNOWLEDGED,
        EventStatus.INSPECTION_SCHEDULED,
    },
    EventStatus.FAILED: set(),
}


def assert_can_decide(current: EventStatus) -> None:
    """Allow a supervisor decision from any state except FAILED (ARCHITECTURE.md §5.2)."""
    if current is EventStatus.FAILED:
        raise InvalidStateTransitionError(
            message="A failed alert cannot receive a decision.",
            details={"current_status": current.value},
        )


async def apply_transition(
    session: AsyncSession,
    event_id: str,
    to_status: EventStatus,
    actor: str,
    reason: str | None = None,
    data: dict[str, Any] | None = None,
) -> Event:
    """Apply event state transition with SELECT FOR UPDATE and append audit log."""
    stmt = select(Event).where(Event.id == event_id).with_for_update()
    event = (await session.execute(stmt)).scalar_one_or_none()
    if not event:
        raise NotFoundError(
            message=f"Event {event_id} not found",
            details={"event_id": event_id},
        )

    current_status = event.status
    if current_status == to_status:
        # Idempotent no-op
        return event

    allowed = VALID_TRANSITIONS.get(current_status, set())
    if to_status not in allowed:
        raise InvalidStateTransitionError(
            message=f"Cannot transition event from {current_status.value} to {to_status.value}",
            details={
                "event_id": event_id,
                "current_status": current_status.value,
                "target_status": to_status.value,
            },
        )

    now = datetime.now(UTC)
    event.status = to_status
    event.updated_at = now

    if to_status in TERMINAL_DECISIONS:
        event.decision = to_status.value
        event.decided_at = now
        if actor.startswith("usr_"):
            event.decided_by = actor

    audit_entry = AuditLog(
        actor=actor,
        action=f"event.transition.{to_status.value.lower()}",
        entity_type="event",
        entity_id=event_id,
        data={
            "from_status": current_status.value,
            "to_status": to_status.value,
            "reason": reason,
            **(data or {}),
        },
        created_at=now,
    )
    session.add(audit_entry)
    await session.flush()
    return event
