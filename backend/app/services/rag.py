"""RAG retrieval service querying manual chunks with pgvector per ARCHITECTURE.md §4.4."""

from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ManualChunk
from app.services.embeddings import embed_text


class RetrievedChunk(BaseModel):
    """Retrieved manual chunk with page and content."""

    manual_id: str
    machine_id: str | None
    page: int
    chunk_index: int
    content: str
    distance: float | None = None


async def retrieve_relevant_chunks(
    session: AsyncSession,
    query_text: str,
    machine_id: str | None = None,
    limit: int = 4,
) -> list[RetrievedChunk]:
    """Retrieve top relevant manual chunks ordered by cosine distance."""
    query_vector = embed_text(query_text)

    # Use pgvector cosine distance method
    distance_col = ManualChunk.embedding.cosine_distance(query_vector).label("distance")

    stmt = (
        select(ManualChunk, distance_col)
        .where(
            or_(
                ManualChunk.machine_id == machine_id,
                ManualChunk.machine_id.is_(None),
            )
        )
        .order_by(distance_col.asc())
        .limit(limit)
    )

    result = await session.execute(stmt)
    rows = result.all()

    retrieved: list[RetrievedChunk] = []
    for chunk, dist in rows:
        retrieved.append(
            RetrievedChunk(
                manual_id=chunk.manual_id,
                machine_id=chunk.machine_id,
                page=chunk.page,
                chunk_index=chunk.chunk_index,
                content=chunk.content,
                distance=float(dist) if dist is not None else None,
            )
        )
    return retrieved
