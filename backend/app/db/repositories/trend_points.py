"""TrendPoint repository for vibration history and charts."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import TrendPoint


async def create_trend_point(
    session: AsyncSession,
    trend_point: TrendPoint,
) -> TrendPoint:
    """Insert a single trend point."""
    session.add(trend_point)
    await session.flush()
    return trend_point


async def get_trend_points(
    session: AsyncSession,
    machine_id: str,
    from_ts: datetime,
    to_ts: datetime,
    limit: int = 1000,
) -> list[TrendPoint]:
    """Retrieve trend points for machine within timestamp bounds."""
    query = (
        select(TrendPoint)
        .where(
            TrendPoint.machine_id == machine_id,
            TrendPoint.ts >= from_ts,
            TrendPoint.ts <= to_ts,
        )
        .order_by(TrendPoint.ts.asc())
        .limit(limit)
    )
    result = await session.execute(query)
    return list(result.scalars().all())
