"""Redis pub/sub event bus for real-time live updates per ARCHITECTURE.md §3.7."""

import json
from datetime import UTC, datetime
from typing import Any

import redis.asyncio as aioredis

from app.api.deps import get_redis_pool
from app.logging import get_logger

logger = get_logger("events_bus")

SSE_CHANNEL = "sse.events"


async def publish_event(
    redis_client: aioredis.Redis,
    event_name: str,
    payload: dict[str, Any],
    owner_id: str,
) -> None:
    """Publish an update to the sse.events Redis channel tagged with owner_id."""
    message = {
        "event": event_name,
        "owner_id": owner_id,
        "data": payload,
    }
    await redis_client.publish(SSE_CHANNEL, json.dumps(message))


async def publish_event_updated(
    event_id: str,
    machine_id: str,
    status: str,
    owner_id: str = "",
    redis_client: aioredis.Redis | None = None,
) -> None:
    """Publish an event.updated notification to Redis pub/sub."""
    payload = {
        "event_id": event_id,
        "machine_id": machine_id,
        "status": status,
        "updated_at": datetime.now(UTC).isoformat(),
    }
    client = redis_client
    close_client = False
    if client is None:
        client = aioredis.Redis(connection_pool=get_redis_pool())
        close_client = True

    try:
        await publish_event(
            redis_client=client,
            event_name="event.updated",
            payload=payload,
            owner_id=owner_id,
        )
    finally:
        if close_client:
            await client.aclose()


async def publish_machine_updated(
    machine_id: str,
    status: str,
    device_online: bool,
    owner_id: str = "",
    redis_client: aioredis.Redis | None = None,
) -> None:
    """Publish a machine.updated notification to Redis pub/sub."""
    payload = {
        "machine_id": machine_id,
        "status": status,
        "device_online": device_online,
    }
    client = redis_client
    close_client = False
    if client is None:
        client = aioredis.Redis(connection_pool=get_redis_pool())
        close_client = True

    try:
        await publish_event(
            redis_client=client,
            event_name="machine.updated",
            payload=payload,
            owner_id=owner_id,
        )
    finally:
        if close_client:
            await client.aclose()
