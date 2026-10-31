"""Redis helpers for device rate limiting, idempotency, daily call cap, and cooldown."""

from datetime import UTC, datetime

import redis.asyncio as aioredis


async def check_device_rate_limit(
    redis_client: aioredis.Redis,
    device_id: str,
    rate_per_min: int = 6,
) -> bool:
    """Check and increment per-minute rate limit for device. Returns True if within limit."""
    now = datetime.now(UTC)
    minute_str = now.strftime("%Y%m%d%H%M")
    key = f"ratelimit:device:{device_id}:{minute_str}"

    count = await redis_client.incr(key)
    if count == 1:
        await redis_client.expire(key, 70)
    return bool(count <= rate_per_min)


async def check_idempotency(
    redis_client: aioredis.Redis,
    device_id: str,
    seq: int,
    ttl_s: int = 86400,
) -> bool:
    """Set idempotency key with NX. Returns True if new (acquired), False if duplicate."""
    key = f"idem:{device_id}:{seq}"
    acquired = await redis_client.set(key, "1", nx=True, ex=ttl_s)
    return bool(acquired)


async def check_daily_call_cap(
    redis_client: aioredis.Redis,
    machine_id: str,
    cap: int = 5,
) -> bool:
    """Increment and check daily call cap for machine. Returns True if within cap."""
    now = datetime.now(UTC)
    day_str = now.strftime("%Y%m%d")
    key = f"calls:machine:{machine_id}:{day_str}"

    count = await redis_client.incr(key)
    if count == 1:
        await redis_client.expire(key, 93600)  # 26 hours
    return bool(count <= cap)


async def acquire_cooldown(
    redis_client: aioredis.Redis,
    machine_id: str,
    cooldown_s: int = 1800,
) -> bool:
    """Attempt to acquire 30-minute cooldown lock for machine. Returns True if acquired."""
    key = f"cooldown:machine:{machine_id}"
    acquired = await redis_client.set(key, "1", nx=True, ex=cooldown_s)
    return bool(acquired)
