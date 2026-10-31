"""Manual document ingestion and chunking service per ARCHITECTURE.md §4.1 and §6.1."""

import asyncio
from pathlib import Path
from typing import Any

from pypdf import PdfReader

from app.config import settings
from app.db.models import Manual, ManualChunk
from app.db.session import async_session_factory
from app.logging import get_logger
from app.services.embeddings import embed_chunks

logger = get_logger("manual_ingest")

CHUNK_SIZE_WORDS: int = 460  # ~600 tokens (words * 1.3)
OVERLAP_WORDS: int = 75  # ~100 tokens overlap


def _chunk_text(page_num: int, text: str) -> list[dict[str, Any]]:
    """Split page text into overlapping word windows."""
    words = text.split()
    if not words:
        return []

    chunks: list[dict[str, Any]] = []
    step = max(1, CHUNK_SIZE_WORDS - OVERLAP_WORDS)

    for idx, start in enumerate(range(0, len(words), step)):
        end = min(start + CHUNK_SIZE_WORDS, len(words))
        chunk_words = words[start:end]
        chunk_str = " ".join(chunk_words)
        chunks.append(
            {
                "page": page_num,
                "chunk_index": idx,
                "content": chunk_str,
            }
        )
        if end >= len(words):
            break

    return chunks


def _parse_pdf_file(file_path: Path) -> tuple[int, list[dict[str, Any]]]:
    """Synchronous CPU-bound PDF parser extracting and chunking text."""
    reader = PdfReader(str(file_path))
    page_count = len(reader.pages)
    all_chunks: list[dict[str, Any]] = []
    total_text = ""
    chunk_index = 0

    for page_idx, page in enumerate(reader.pages):
        page_num = page_idx + 1
        extracted = page.extract_text() or ""
        total_text += extracted.strip()
        page_chunks = _chunk_text(page_num, extracted)
        for c in page_chunks:
            c["chunk_index"] = chunk_index
            chunk_index += 1
            all_chunks.append(c)

    if not total_text.strip():
        return page_count, []

    return page_count, all_chunks


async def process_manual_file(
    manual_id: str,
    session_factory: object = None,
) -> None:
    """Read uploaded manual PDF, extract text, embed chunks, and mark READY."""
    session_maker = session_factory or async_session_factory

    async with session_maker() as session:  # type: ignore[operator]
        manual = await session.get(Manual, manual_id)
        if not manual:
            logger.error("manual_ingest_not_found", manual_id=manual_id)
            return

        file_path = Path(settings.UPLOAD_DIR) / f"{manual_id}.pdf"
        if not file_path.exists():
            logger.error("manual_file_not_found_on_disk", path=str(file_path))
            manual.status = "FAILED"
            manual.error_code = "FILE_NOT_FOUND"
            await session.commit()
            return

        try:
            page_count, chunks = await asyncio.to_thread(_parse_pdf_file, file_path)
            manual.page_count = page_count

            if not chunks:
                logger.warning("manual_pdf_no_text_scanned", manual_id=manual_id)
                manual.status = "FAILED"
                manual.error_code = "MANUAL_PARSE_FAILED"
                await session.commit()
                return

            # Batch compute embeddings
            contents = [str(c["content"]) for c in chunks]
            embeddings = await asyncio.to_thread(embed_chunks, contents)

            for c, emb in zip(chunks, embeddings, strict=True):
                chunk_row = ManualChunk(
                    manual_id=manual_id,
                    machine_id=manual.machine_id,
                    page=int(c["page"]),
                    chunk_index=int(c["chunk_index"]),
                    content=str(c["content"]),
                    embedding=emb,
                )
                session.add(chunk_row)

            manual.status = "READY"
            manual.embedding_model = settings.EMBEDDING_BACKEND
            await session.commit()
            logger.info("manual_ingest_complete", manual_id=manual_id, chunks=len(chunks))
        except Exception as exc:
            logger.error("manual_ingest_exception", error=str(exc), manual_id=manual_id)
            manual.status = "FAILED"
            manual.error_code = "MANUAL_PARSE_FAILED"
            await session.commit()
