"""Machine repository scoped strictly by owner."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Machine


async def list_machines_by_owner(
    session: AsyncSession,
    owner_id: str,
    limit: int = 100,
    cursor: str | None = None,
) -> list[Machine]:
    """List machines owned by owner_id with cursor pagination and limit."""
    query = (
        select(Machine)
        .where(Machine.owner_id == owner_id)
        .options(selectinload(Machine.device))
        .order_by(Machine.created_at.desc(), Machine.id.desc())
        .limit(limit)
    )
    if cursor:
        query = query.where(Machine.id < cursor)
    result = await session.execute(query)
    return list(result.scalars().all())


async def get_machine_by_id(
    session: AsyncSession,
    machine_id: str,
    owner_id: str | None = None,
) -> Machine | None:
    """Fetch machine by ID, optionally scoped to owner."""
    query = select(Machine).where(Machine.id == machine_id).options(selectinload(Machine.device))
    if owner_id is not None:
        query = query.where(Machine.owner_id == owner_id)
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def create_machine(
    session: AsyncSession,
    machine: Machine,
) -> Machine:
    """Create and persist a new machine."""
    session.add(machine)
    await session.flush()
    await session.refresh(machine, ["device"])
    return machine


async def update_machine_status(
    session: AsyncSession,
    machine_id: str,
    status: str,
) -> None:
    """Update machine status."""
    machine = await session.get(Machine, machine_id)
    if machine:
        machine.status = status
        await session.flush()
