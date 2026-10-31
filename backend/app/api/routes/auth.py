"""Authentication routes per ARCHITECTURE.md §3.2 and §3.4."""

from datetime import UTC, datetime

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, get_redis
from app.db.models import User
from app.db.repositories.users import create_user, get_user_by_email
from app.errors import EmailTakenError, RateLimitedError, UnauthenticatedError
from app.ids import generate_id
from app.schemas.auth import LoginIn, RegisterIn, TokenOut
from app.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/v1/auth", tags=["auth"])

FAILED_LOGIN_LIMIT = 5
LOCKOUT_SECONDS = 900  # 15 minutes


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterIn,
    session: AsyncSession = Depends(get_db),
) -> TokenOut:
    """Register a new factory owner account and immediately return JWT access token."""
    normalized_email = payload.email.lower().strip()
    existing_user = await get_user_by_email(session, normalized_email)
    if existing_user:
        raise EmailTakenError(
            message="An account with this email address already exists.",
            details={"email": normalized_email},
        )

    user_id = generate_id("usr_")
    pw_hash = hash_password(payload.password)
    user = await create_user(
        session=session,
        user_id=user_id,
        email=normalized_email,
        password_hash=pw_hash,
        full_name=payload.full_name,
        role="owner",
        onboarding_completed=False,
        onboarding_step=1,
    )
    await session.commit()

    token = create_access_token(
        user_id=user.id,
        role=user.role,
        email=user.email,
    )
    return TokenOut(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        role=user.role,
    )


@router.post("/login", response_model=TokenOut)
async def login(
    payload: LoginIn,
    session: AsyncSession = Depends(get_db),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> TokenOut:
    """Dashboard user login returning JWT access token with brute-force rate limiting."""
    normalized_email = payload.email.lower().strip()
    rate_key = f"ratelimit:login:failed:{normalized_email}"

    # 1. Check if email is currently rate-limited (S-04)
    failed_count = await redis_client.get(rate_key)
    if failed_count and int(failed_count) >= FAILED_LOGIN_LIMIT:
        raise RateLimitedError(
            message="Too many failed login attempts. Account temporarily locked for 15 minutes.",
            details={"email": normalized_email, "retry_after_s": LOCKOUT_SECONDS},
        )

    # 2. Query user from database
    user = await get_user_by_email(session, normalized_email)

    # 3. Always verify password to prevent timing attacks / user discovery (S-02, S-03)
    target_hash = user.password_hash if user else DUMMY_PASSWORD_HASH
    is_valid = verify_password(payload.password, target_hash)

    if not user or not is_valid:
        new_count = await redis_client.incr(rate_key)
        if new_count == 1:
            await redis_client.expire(rate_key, LOCKOUT_SECONDS)
        raise UnauthenticatedError(message="Invalid email or password.")

    # 4. Success: clear failed login counter
    await redis_client.delete(rate_key)

    token = create_access_token(
        user_id=user.id,
        role=user.role,
        email=user.email,
    )
    return TokenOut(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        role=user.role,
    )


@router.post("/logout")
async def logout(
    authorization: str | None = Header(default=None),
    current_user: User = Depends(get_current_user),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> dict[str, str]:
    """Revoke current JWT token until expiration."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        try:
            payload = decode_access_token(token)
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                remaining_ttl = max(1, exp - int(datetime.now(UTC).timestamp()))
                await redis_client.set(f"jwt:revoked:{jti}", "1", ex=remaining_ttl)
        except Exception as exc:
            # Token invalid or already expired
            _ = exc

    return {"message": "Logged out successfully."}
