"""Audit log repository for immutable audit trail."""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog


async def record_audit_log(
    session: AsyncSession,
    actor: str,
    action: str,
    entity_type: str,
    entity_id: str,
    data: dict[str, Any] | None = None,
) -> AuditLog:
    """Record an audit trail entry in the current transaction."""
    entry = AuditLog(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        data=data,
    )
    session.add(entry)
    await session.flush()
    return entry
