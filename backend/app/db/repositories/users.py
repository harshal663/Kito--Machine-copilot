"""User repository for authentication and user management."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    """Fetch user by email address (case-insensitive)."""
    clean_email = email.strip().lower()
    result = await session.execute(select(User).where(func.lower(User.email) == clean_email))
    return result.scalar_one_or_none()


async def get_user_by_id(session: AsyncSession, user_id: str) -> User | None:
    """Fetch user by ID."""
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_user(
    session: AsyncSession,
    user_id: str,
    email: str,
    password_hash: str,
    full_name: str | None,
    role: str,
    phone: str | None = None,
    language: str = "en",
    onboarding_completed: bool = False,
    onboarding_step: int = 1,
) -> User:
    """Create and persist a new user."""
    user = User(
        id=user_id,
        email=email.strip().lower(),
        password_hash=password_hash,
        full_name=full_name,
        role=role,
        phone=phone,
        language=language,
        onboarding_completed=onboarding_completed,
        onboarding_step=onboarding_step,
    )
    session.add(user)
    await session.flush()
    return user


async def update_user_profile(
    session: AsyncSession,
    user: User,
    full_name: str | None = None,
    phone: str | None = None,
    language: str | None = None,
    onboarding_completed: bool | None = None,
    onboarding_step: int | None = None,
) -> User:
    """Update user personal and onboarding attributes."""
    if full_name is not None:
        user.full_name = full_name
    if phone is not None:
        user.phone = phone
    if language is not None:
        user.language = language
    if onboarding_completed is not None:
        user.onboarding_completed = onboarding_completed
    if onboarding_step is not None:
        user.onboarding_step = onboarding_step
    await session.flush()
    return user
