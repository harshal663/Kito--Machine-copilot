"""Device routes for binding, heartbeat, and remote configuration."""

from datetime import UTC, datetime

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_authenticated_device, get_current_user, get_redis
from app.db.models import Device, User
from app.db.repositories.devices import (
    create_device,
    get_device_by_machine_id,
    update_device_presence,
)
from app.db.repositories.machines import get_machine_by_id, update_machine_status
from app.db.session import get_db
from app.errors import ConflictError, ForbiddenError, NotFoundError
from app.ids import generate_id
from app.schemas.device import (
    DeviceConfig,
    DeviceCreate,
    DeviceCreated,
    HeartbeatIn,
)
from app.security import generate_device_key, hash_device_key
from app.services.presence import mark_device_seen

router = APIRouter(prefix="/v1/devices", tags=["devices"])


@router.post("", response_model=DeviceCreated, status_code=status.HTTP_201_CREATED)
async def bind_device(
    payload: DeviceCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> DeviceCreated:
    """Bind a new sensor device to a machine. Returns device key once."""
    machine = await get_machine_by_id(
        session, machine_id=payload.machine_id, owner_id=current_user.id
    )
    if not machine:
        raise NotFoundError(message="Machine not found.")

    existing_device = await get_device_by_machine_id(session, payload.machine_id)
    if existing_device:
        raise ConflictError(message="Device already bound to this machine.")

    device_id = generate_id("dev_")
    raw_key = generate_device_key()
    key_hash = hash_device_key(raw_key)

    await create_device(
        session=session,
        device_id=device_id,
        machine_id=payload.machine_id,
        key_hash=key_hash,
    )
    await session.commit()

    return DeviceCreated(
        device_id=device_id,
        machine_id=payload.machine_id,
        device_key=raw_key,
        created_at=datetime.now(UTC),
    )


@router.post("/heartbeat", status_code=status.HTTP_204_NO_CONTENT)
async def device_heartbeat(
    payload: HeartbeatIn,
    device: Device = Depends(get_authenticated_device),
    session: AsyncSession = Depends(get_db),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> Response:
    """Sensor node heartbeat liveness update."""
    if device.id != payload.device_id or device.machine_id != payload.machine_id:
        raise ForbiddenError(message="Device does not match machine binding.")

    await mark_device_seen(redis_client, device.id, ttl_s=900)
    await update_device_presence(session, device.id, firmware_version=payload.fw)

    if payload.mode == "LEARNING" and device.machine_id:
        await update_machine_status(session, device.machine_id, "LEARNING")

    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/config", response_model=DeviceConfig)
async def get_device_config(
    device: Device = Depends(get_authenticated_device),
) -> DeviceConfig:
    """Serve sampling and detection thresholds to authenticated sensor node."""
    if not device.machine_id:
        raise NotFoundError(message="Device is not bound to a machine.")

    return DeviceConfig(machine_id=device.machine_id)
