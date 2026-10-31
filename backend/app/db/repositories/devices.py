"""Device repository for binding and presence."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Device


async def get_device_by_id(session: AsyncSession, device_id: str) -> Device | None:
    """Fetch device by ID with loaded machine."""
    query = select(Device).where(Device.id == device_id).options(selectinload(Device.machine))
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def get_device_by_machine_id(session: AsyncSession, machine_id: str) -> Device | None:
    """Fetch device bound to machine_id."""
    query = select(Device).where(Device.machine_id == machine_id)
    result = await session.execute(query)
    return result.scalar_one_or_none()


async def create_device(
    session: AsyncSession,
    device_id: str,
    machine_id: str,
    key_hash: str,
) -> Device:
    """Create and persist a new device binding."""
    device = Device(
        id=device_id,
        machine_id=machine_id,
        key_hash=key_hash,
    )
    session.add(device)
    await session.flush()
    return device


async def update_device_presence(
    session: AsyncSession,
    device_id: str,
    firmware_version: str | None = None,
) -> None:
    """Update device last_seen_at timestamp and firmware version."""
    device = await session.get(Device, device_id)
    if device:
        device.last_seen_at = datetime.now(UTC)
        if firmware_version:
            device.firmware_version = firmware_version
        await session.flush()
