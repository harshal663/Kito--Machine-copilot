"""Device presence service tracking device:seen keys in Redis."""

import redis.asyncio as aioredis


async def is_device_online(redis_client: aioredis.Redis, device_id: str | None) -> bool:
    """Check if device has an active presence key in Redis."""
    if not device_id:
        return False
    seen = await redis_client.get(f"device:seen:{device_id}")
    return seen is not None


async def mark_device_seen(
    redis_client: aioredis.Redis,
    device_id: str,
    ttl_s: int = 900,
) -> None:
    """Set device:seen key in Redis with TTL (default 900 seconds)."""
    await redis_client.set(f"device:seen:{device_id}", "1", ex=ttl_s)
