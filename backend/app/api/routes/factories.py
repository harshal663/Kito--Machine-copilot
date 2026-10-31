"""Factory routes for unit management (Added in run 2)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.db.models import Factory, User
from app.db.repositories.factories import get_factory_by_owner_id, upsert_factory_for_owner
from app.errors import NotFoundError
from app.schemas.factory import FactoryIn, FactoryOut

router = APIRouter(prefix="/v1/factory", tags=["factory"])


def _to_factory_out(factory: Factory) -> FactoryOut:
    return FactoryOut(
        id=factory.id,
        owner_id=factory.owner_id,
        name=factory.name,
        industry=factory.industry,
        address_line=factory.address_line,
        city=factory.city,
        state=factory.state,
        pincode=factory.pincode,
        employee_band=factory.employee_band,
        gstin=factory.gstin,
        created_at=factory.created_at,
        updated_at=factory.updated_at,
    )


@router.get("", response_model=FactoryOut)
async def get_my_factory(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> FactoryOut:
    """Fetch current owner's factory profile."""
    factory = await get_factory_by_owner_id(session, current_user.id)
    if not factory:
        raise NotFoundError(message="No factory registered for this owner.")
    return _to_factory_out(factory)


@router.put("", response_model=FactoryOut)
async def create_or_update_factory(
    payload: FactoryIn,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> FactoryOut:
    """Create or update the single factory for the current owner."""
    factory = await upsert_factory_for_owner(
        session=session,
        owner_id=current_user.id,
        payload=payload,
    )
    await session.commit()
    return _to_factory_out(factory)

