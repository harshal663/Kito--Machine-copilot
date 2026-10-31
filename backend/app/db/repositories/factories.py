"""Factory repository for owner unit management (Added in run 2)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Factory
from app.ids import generate_id
from app.schemas.factory import FactoryIn


async def get_factory_by_owner_id(session: AsyncSession, owner_id: str) -> Factory | None:
    """Fetch factory belonging to the specified owner."""
    result = await session.execute(select(Factory).where(Factory.owner_id == owner_id))
    return result.scalar_one_or_none()


async def get_factory_by_id(session: AsyncSession, factory_id: str) -> Factory | None:
    """Fetch factory by its ID."""
    result = await session.execute(select(Factory).where(Factory.id == factory_id))
    return result.scalar_one_or_none()


async def upsert_factory_for_owner(
    session: AsyncSession,
    owner_id: str,
    payload: FactoryIn,
) -> Factory:
    """Create or update the single factory for an owner."""
    factory = await get_factory_by_owner_id(session, owner_id)
    if factory is None:
        factory = Factory(
            id=generate_id("fac_"),
            owner_id=owner_id,
            name=payload.name,
            industry=payload.industry,
            address_line=payload.address_line,
            city=payload.city,
            state=payload.state,
            pincode=payload.pincode,
            employee_band=payload.employee_band,
            gstin=payload.gstin,
        )
        session.add(factory)
    else:
        factory.name = payload.name
        factory.industry = payload.industry
        factory.address_line = payload.address_line
        factory.city = payload.city
        factory.state = payload.state
        factory.pincode = payload.pincode
        factory.employee_band = payload.employee_band
        factory.gstin = payload.gstin

    await session.flush()
    return factory

