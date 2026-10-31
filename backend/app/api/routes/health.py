"""Health check routes for liveness and readiness probes."""

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_redis
from app.db.session import get_db
from app.errors import InternalError

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    """Process liveness probe."""
    return {"status": "ok"}


@router.get("/readyz")
async def readyz(
    session: AsyncSession = Depends(get_db),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> dict[str, str]:
    """Database and Redis readiness probe."""
    try:
        await session.execute(text("SELECT 1"))
    except Exception as exc:
        raise InternalError(message="Database check failed.") from exc

    try:
        await redis_client.ping()
    except Exception as exc:
        raise InternalError(message="Redis check failed.") from exc

    return {"status": "ready", "database": "ok", "redis": "ok"}
