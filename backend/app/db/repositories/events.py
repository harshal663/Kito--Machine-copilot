"""Event and CallAttempt repository."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import CallAttempt, Event, EventStatus


async def get_event_by_id(
    session: AsyncSession,
    event_id: str,
    for_update: bool = False,
) -> Event | None:
    """Fetch event by ID with call attempts loaded, optionally locking for update."""
    query = select(Event).where(Event.id == event_id).options(selectinload(Event.call_attempts))
    if for_update:
        query = query.with_for_update()
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def get_event_by_device_seq(
    session: AsyncSession,
    device_id: str,
    seq: int,
) -> Event | None:
    """Fetch event by device_id and sequence for idempotency."""
    query = select(Event).where(Event.device_id == device_id, Event.seq == seq)
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def list_events_by_machine(
    session: AsyncSession,
    machine_id: str,
    status: EventStatus | None = None,
    limit: int = 20,
    cursor: str | None = None,
) -> list[Event]:
    """List events for a machine with cursor pagination and optional status filter."""
    query = (
        select(Event)
        .where(Event.machine_id == machine_id)
        .order_by(Event.created_at.desc(), Event.id.desc())
        .limit(limit)
    )
    if status is not None:
        query = query.where(Event.status == status)
    if cursor is not None:
        query = query.where(Event.id < cursor)
    result = await session.execute(query)
    return list(result.scalars().all())


async def list_events_by_machine_ids(
    session: AsyncSession,
    machine_ids: list[str],
    status: EventStatus | None = None,
    limit: int = 50,
    cursor: str | None = None,
) -> list[Event]:
    """List events across multiple machines with cursor pagination and optional status filter."""
    if not machine_ids:
        return []
    query = (
        select(Event)
        .where(Event.machine_id.in_(machine_ids))
        .order_by(Event.created_at.desc(), Event.id.desc())
        .limit(limit)
    )
    if status is not None:
        query = query.where(Event.status == status)
    if cursor is not None:
        query = query.where(Event.id < cursor)
    result = await session.execute(query)
    return list(result.scalars().all())


async def count_open_events_by_machine(
    session: AsyncSession,
    machine_id: str,
) -> int:
    """Count non-terminal events for machine."""
    terminal_statuses = [
        EventStatus.ACKNOWLEDGED,
        EventStatus.INSPECTION_SCHEDULED,
        EventStatus.SHUTDOWN_REQUESTED,
        EventStatus.FAILED,
    ]
    query = select(Event).where(
        Event.machine_id == machine_id,
        Event.status.not_in(terminal_statuses),
    )
    result = await session.execute(query)
    return len(result.scalars().all())


async def create_event(
    session: AsyncSession,
    event: Event,
) -> Event:
    """Create and persist an event."""
    session.add(event)
    await session.flush()
    await session.refresh(event, ["call_attempts"])
    return event


async def create_call_attempt(
    session: AsyncSession,
    call_attempt: CallAttempt,
) -> CallAttempt:
    """Create and persist a call attempt."""
    session.add(call_attempt)
    await session.flush()
    return call_attempt


async def get_call_attempt_by_id(
    session: AsyncSession,
    attempt_id: str,
) -> CallAttempt | None:
    """Fetch call attempt by ID."""
    query = select(CallAttempt).where(CallAttempt.id == attempt_id)
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def update_call_attempt(
    session: AsyncSession,
    attempt_id: str,
    state: str,
    transcript: str | None = None,
    extracted_decision: str | None = None,
    ended_at: datetime | None = None,
) -> None:
    """Update call attempt record."""
    attempt = await session.get(CallAttempt, attempt_id)
    if attempt:
        attempt.state = state
        if transcript is not None:
            attempt.transcript = transcript
        if extracted_decision is not None:
            attempt.extracted_decision = extracted_decision
        if ended_at is not None:
            attempt.ended_at = ended_at
        await session.flush()
