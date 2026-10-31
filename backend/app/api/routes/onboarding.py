"""Onboarding route per ARCHITECTURE.md §3.4 (Added in run 2)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.db.models import User
from app.db.repositories.factories import get_factory_by_owner_id
from app.db.repositories.machines import list_machines_by_owner
from app.db.repositories.users import update_user_profile
from app.errors import OnboardingIncompleteError
from app.schemas.onboarding import OnboardingCompleteIn
from app.schemas.user import UserOut

router = APIRouter(prefix="/v1/onboarding", tags=["onboarding"])


@router.post("/complete", response_model=UserOut)
async def complete_onboarding(
    payload: OnboardingCompleteIn,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> UserOut:
    """Mark onboarding done. Requires a factory, and >=1 machine unless machines_skipped is true."""
    # 1. Require factory
    factory = await get_factory_by_owner_id(session, current_user.id)
    if not factory:
        raise OnboardingIncompleteError(
            message="Onboarding incomplete: Factory details must be completed before finishing.",
            details={"missing": "factory"},
        )

    # 2. Require >= 1 machine unless explicitly skipped
    if not payload.machines_skipped:
        machines = await list_machines_by_owner(session, current_user.id, limit=1)
        if not machines:
            raise OnboardingIncompleteError(
                message=(
                    "Onboarding incomplete: At least one machine must be added or"
                    " explicitly skipped."
                ),
                details={"missing": "machine"},
            )

    # 3. Mark completed
    updated = await update_user_profile(
        session=session,
        user=current_user,
        onboarding_completed=True,
        onboarding_step=4,
    )
    await session.commit()

    return UserOut(
        id=updated.id,
        email=updated.email,
        full_name=updated.full_name,
        phone=updated.phone,
        language=updated.language,
        role=updated.role,
        onboarding_completed=updated.onboarding_completed,
        onboarding_step=updated.onboarding_step,
        created_at=updated.created_at,
    )
