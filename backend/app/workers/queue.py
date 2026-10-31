"""Arq client pool and enqueue helpers."""

import asyncio
from typing import Any

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from app.config import settings

_arq_pool: ArqRedis | None = None
_arq_pool_loop: asyncio.AbstractEventLoop | None = None


def get_redis_settings() -> RedisSettings:
    """Parse application REDIS_URL into arq RedisSettings."""
    return RedisSettings.from_dsn(settings.REDIS_URL)


async def get_arq_pool() -> ArqRedis:
    """Get or create singleton ArqRedis client pool for current running loop."""
    global _arq_pool, _arq_pool_loop
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if _arq_pool is None or _arq_pool_loop != current_loop:
        _arq_pool = await create_pool(get_redis_settings())
        _arq_pool_loop = current_loop
    return _arq_pool


async def enqueue_job(job_name: str, *args: Any, **kwargs: Any) -> None:
    """Enqueue background job into arq queue."""
    pool = await get_arq_pool()
    await pool.enqueue_job(job_name, *args, **kwargs)
