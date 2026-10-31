"""Manual PDF upload and status endpoints per ARCHITECTURE.md §3.4 and §4.1."""

import asyncio
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.config import settings
from app.db.models import Manual, User
from app.db.repositories.machines import get_machine_by_id
from app.errors import ManualParseFailedError, NotFoundError, ValidationError
from app.ids import generate_id
from app.logging import get_logger
from app.schemas.manual import ManualOut
from app.workers.queue import enqueue_job

router = APIRouter(tags=["manuals"])
logger = get_logger("manuals_route")

MAX_MANUAL_SIZE_BYTES: int = 20 * 1024 * 1024  # 20 MB
PDF_MAGIC_BYTES: bytes = b"%PDF-"


@router.post(
    "/v1/machines/{machine_id}/manuals",
    response_model=ManualOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_machine_manual(
    machine_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ManualOut:
    """Upload a machine manual PDF (max 20 MB, validated by magic bytes)."""
    machine = await get_machine_by_id(session, machine_id=machine_id, owner_id=current_user.id)
    if not machine:
        raise NotFoundError("Machine not found.")

    # Read initial chunk to check magic bytes and total size
    content = await file.read()
    if len(content) > MAX_MANUAL_SIZE_BYTES:
        raise ValidationError(
            message="Uploaded file exceeds the maximum allowed size of 20 MB.",
            details={"max_bytes": MAX_MANUAL_SIZE_BYTES, "file_bytes": len(content)},
        )

    if not content.startswith(PDF_MAGIC_BYTES):
        raise ManualParseFailedError(
            message="Uploaded file is not a valid PDF document.",
            details={"magic_bytes": content[:8].hex()},
        )

    # Ensure upload directory exists
    upload_path = Path(settings.UPLOAD_DIR)
    await asyncio.to_thread(upload_path.mkdir, parents=True, exist_ok=True)

    manual_id = generate_id("man_")
    destination = upload_path / f"{manual_id}.pdf"
    await asyncio.to_thread(destination.write_bytes, content)

    manual = Manual(
        id=manual_id,
        machine_id=machine_id,
        filename=file.filename or f"{manual_id}.pdf",
        status="PROCESSING",
        embedding_model=settings.EMBEDDING_BACKEND,
        created_at=datetime.now(UTC),
    )
    session.add(manual)
    await session.commit()
    await session.refresh(manual)

    # Enqueue background ingestion
    await enqueue_job("ingest_manual", manual_id)

    return ManualOut(
        id=manual.id,
        machine_id=manual.machine_id,
        filename=manual.filename,
        page_count=manual.page_count,
        status=manual.status,  # type: ignore[arg-type]
        embedding_model=manual.embedding_model,
        error_code=manual.error_code,
        created_at=manual.created_at,
    )


@router.get("/v1/manuals/{manual_id}", response_model=ManualOut)
async def get_manual_status(
    manual_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ManualOut:
    """Check ingestion status of a manual document."""
    manual = await session.get(Manual, manual_id)
    if not manual:
        raise NotFoundError("Manual not found.")

    if manual.machine_id:
        machine = await get_machine_by_id(
            session, machine_id=manual.machine_id, owner_id=current_user.id
        )
        if not machine:
            raise NotFoundError("Manual not found.")

    return ManualOut(
        id=manual.id,
        machine_id=manual.machine_id,
        filename=manual.filename,
        page_count=manual.page_count,
        status=manual.status,  # type: ignore[arg-type]
        embedding_model=manual.embedding_model,
        error_code=manual.error_code,
        created_at=manual.created_at,
    )
