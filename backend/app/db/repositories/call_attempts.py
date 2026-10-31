"""Call attempt database repository."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CallAttempt


async def create_call_attempt(session: AsyncSession, attempt: CallAttempt) -> CallAttempt:
    """Insert a new call attempt row."""
    session.add(attempt)
    await session.flush()
    return attempt


async def get_call_attempt_by_id(session: AsyncSession, attempt_id: str) -> CallAttempt | None:
    """Fetch call attempt by its primary key ID."""
    stmt = select(CallAttempt).where(CallAttempt.id == attempt_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_call_attempt_by_event_and_attempt(
    session: AsyncSession,
    event_id: str,
    attempt_no: int,
) -> CallAttempt | None:
    """Fetch call attempt by event ID and attempt number."""
    stmt = select(CallAttempt).where(
        CallAttempt.event_id == event_id,
        CallAttempt.attempt_no == attempt_no,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def list_attempts_for_event(session: AsyncSession, event_id: str) -> list[CallAttempt]:
    """List all call attempts for an event ordered by attempt number."""
    stmt = (
        select(CallAttempt)
        .where(CallAttempt.event_id == event_id)
        .order_by(CallAttempt.attempt_no.asc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())
