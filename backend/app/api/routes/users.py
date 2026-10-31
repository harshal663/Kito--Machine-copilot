"""User profile and personal details routes (Added in run 2)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.db.repositories.users import update_user_profile
from app.schemas.user import UserOut, UserUpdateIn

router = APIRouter(prefix="/v1", tags=["users"])


def _to_user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        language=user.language,
        role=user.role,
        onboarding_completed=user.onboarding_completed,
        onboarding_step=user.onboarding_step,
        created_at=user.created_at,
    )


@router.get("/me", response_model=UserOut)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
) -> UserOut:
    """Fetch profile of current authenticated user, including onboarding state."""
    return _to_user_out(current_user)


@router.patch("/me", response_model=UserOut)
async def update_my_profile(
    payload: UserUpdateIn,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> UserOut:
    """Update personal details (full name, phone, language) for current user."""
    updated = await update_user_profile(
        session=session,
        user=current_user,
        full_name=payload.full_name,
        phone=payload.phone,
        language=payload.language,
    )
    await session.commit()
    return _to_user_out(updated)

