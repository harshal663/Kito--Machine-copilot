"""Dependency injection providers for database, auth, devices, and redis."""

import asyncio
from collections.abc import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Device, User
from app.db.repositories.users import get_user_by_id
from app.db.session import get_db as get_db
from app.errors import DeviceKeyInvalidError, UnauthenticatedError
from app.security import decode_access_token, hash_device_key

_redis_pool: aioredis.ConnectionPool | None = None
_redis_pool_loop: asyncio.AbstractEventLoop | None = None


def get_redis_pool() -> aioredis.ConnectionPool:
    """Get or create singleton Redis connection pool for current running loop."""
    global _redis_pool, _redis_pool_loop
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if _redis_pool is None or _redis_pool_loop != current_loop:
        _redis_pool = aioredis.ConnectionPool.from_url(
            settings.REDIS_URL,
            decode_responses=True,
        )
        _redis_pool_loop = current_loop
    return _redis_pool


async def get_redis() -> AsyncGenerator[aioredis.Redis, None]:
    """Dependency yielding an async Redis client."""
    client = aioredis.Redis(connection_pool=get_redis_pool())
    try:
        yield client
    finally:
        await client.aclose()


async def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    session: AsyncSession = Depends(get_db),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> User:
    """Authenticate dashboard user via Bearer token."""
    # S-09: Reject tokens passed in query string
    if "token" in request.query_params or "access_token" in request.query_params:
        raise UnauthenticatedError(
            message="Tokens must not be passed in query parameters. Use the Authorization header."
        )

    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthenticatedError(message="Bearer token required in Authorization header.")

    token = authorization.removeprefix("Bearer ").strip()
    payload = decode_access_token(token)

    # Check if token was revoked
    jti = payload.get("jti")
    if jti:
        is_revoked = await redis_client.exists(f"jwt:revoked:{jti}")
        if is_revoked:
            raise UnauthenticatedError(message="Token has been revoked.")

    user_id = payload.get("sub")
    if not user_id:
        raise UnauthenticatedError(message="Invalid token claims.")

    user = await get_user_by_id(session, user_id)
    if not user:
        raise UnauthenticatedError(message="User not found.")
    return user


async def get_authenticated_device(
    x_device_key: str | None = Header(default=None, alias="X-Device-Key"),
    session: AsyncSession = Depends(get_db),
) -> Device:
    """Authenticate sensor node via X-Device-Key header."""
    if not x_device_key:
        raise DeviceKeyInvalidError(message="Missing X-Device-Key header.")

    key_hash = hash_device_key(x_device_key)
    from sqlalchemy import select

    result = await session.execute(select(Device).where(Device.key_hash == key_hash))
    device = result.scalar_one_or_none()
    if not device:
        raise DeviceKeyInvalidError(message="Unknown or invalid device key.")
    return device
