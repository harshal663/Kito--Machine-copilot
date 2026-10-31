"""Telemetry ingestion route per ARCHITECTURE.md §3.4 and §3.5."""

import json

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_authenticated_device, get_redis
from app.db.models import Device
from app.db.repositories.devices import update_device_presence
from app.db.repositories.machines import update_machine_status
from app.db.session import get_db
from app.errors import ForbiddenError, ValidationError
from app.schemas.device import HeartbeatIn
from app.schemas.telemetry import TelemetryAccepted, TelemetryIn
from app.services.alerts import process_telemetry_report
from app.services.presence import mark_device_seen

router = APIRouter(prefix="/v1/telemetry", tags=["telemetry"])

MAX_TELEMETRY_BODY_BYTES: int = (
    16 * 1024
)  # 16 KB limit per ARCHITECTURE §3.2 and Security Tests S-27


async def _verify_body_size(request: Request) -> bytes:
    """Enforce maximum body size of 16 KB, rejecting oversized requests with 422."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_TELEMETRY_BODY_BYTES:
        raise ValidationError(message="Telemetry payload exceeds maximum allowed size of 16 KB.")

    raw_body = await request.body()
    if len(raw_body) > MAX_TELEMETRY_BODY_BYTES:
        raise ValidationError(message="Telemetry payload exceeds maximum allowed size of 16 KB.")
    return raw_body


@router.post("", response_model=TelemetryAccepted, status_code=status.HTTP_202_ACCEPTED)
async def ingest_telemetry(
    request: Request,
    device: Device = Depends(get_authenticated_device),
    session: AsyncSession = Depends(get_db),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> TelemetryAccepted:
    """Ingest anomaly vibration telemetry from sensor node."""
    raw_body = await _verify_body_size(request)
    try:
        data = json.loads(raw_body.decode("utf-8"))
        payload = TelemetryIn.model_validate(data)
    except Exception as exc:
        raise ValidationError(message=f"Request validation failed: {exc}") from exc

    return await process_telemetry_report(
        session=session,
        redis_client=redis_client,
        device=device,
        payload=payload,
    )


@router.post("/heartbeat", status_code=status.HTTP_204_NO_CONTENT)
async def telemetry_heartbeat(
    request: Request,
    device: Device = Depends(get_authenticated_device),
    session: AsyncSession = Depends(get_db),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> Response:
    """Sensor node heartbeat liveness update."""
    raw_body = await _verify_body_size(request)
    try:
        data = json.loads(raw_body.decode("utf-8"))
        payload = HeartbeatIn.model_validate(data)
    except Exception as exc:
        raise ValidationError(message=f"Request validation failed: {exc}") from exc

    if device.id != payload.device_id or device.machine_id != payload.machine_id:
        raise ForbiddenError(message="Device does not match machine binding.")

    await mark_device_seen(redis_client, device.id, ttl_s=900)
    await update_device_presence(session, device.id, firmware_version=payload.fw)

    if payload.mode == "LEARNING" and device.machine_id:
        await update_machine_status(session, device.machine_id, "LEARNING")

    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
