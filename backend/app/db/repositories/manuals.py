"""Manual and ManualChunk repository with vector similarity search."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Manual, ManualChunk


async def get_manual_by_id(session: AsyncSession, manual_id: str) -> Manual | None:
    """Fetch manual record by ID."""
    return await session.get(Manual, manual_id)


async def create_manual(session: AsyncSession, manual: Manual) -> Manual:
    """Create and persist a manual record."""
    session.add(manual)
    await session.flush()
    return manual


async def update_manual_status(
    session: AsyncSession,
    manual_id: str,
    status: str,
    page_count: int | None = None,
    error_code: str | None = None,
) -> None:
    """Update manual ingestion status and error code."""
    manual = await session.get(Manual, manual_id)
    if manual:
        manual.status = status
        if page_count is not None:
            manual.page_count = page_count
        if error_code is not None:
            manual.error_code = error_code
        await session.flush()


async def insert_manual_chunks(
    session: AsyncSession,
    chunks: list[ManualChunk],
) -> None:
    """Bulk insert manual chunks."""
    session.add_all(chunks)
    await session.flush()


async def search_manual_chunks(
    session: AsyncSession,
    embedding: list[float],
    machine_id: str | None = None,
    limit: int = 4,
) -> list[ManualChunk]:
    """Search manual chunks ordered by cosine distance with machine and generic fallback."""
    # Where machine_id = :machine_id OR machine_id IS NULL
    query = select(ManualChunk)
    if machine_id is not None:
        query = query.where(
            (ManualChunk.machine_id == machine_id) | (ManualChunk.machine_id.is_(None))
        )
    else:
        query = query.where(ManualChunk.machine_id.is_(None))

    query = query.order_by(ManualChunk.embedding.cosine_distance(embedding)).limit(limit)
    result = await session.execute(query)
    return list(result.scalars().all())
