"""Escalation notifications via SMS/WhatsApp per ARCHITECTURE.md §4.1 and §4.3."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.twilio import send_sms
from app.db.models import Event, EventStatus, Machine
from app.errors import NotFoundError
from app.logging import get_logger
from app.services.events_bus import publish_event_updated
from app.services.state_machine import TERMINAL_STATES, apply_transition

logger = get_logger("notifier_service")


async def send_escalation_notification(
    session: AsyncSession,
    event_id: str,
) -> None:
    """Send SMS notification to backup contact and transition event to ESCALATED."""
    event = await session.get(Event, event_id)
    if not event:
        raise NotFoundError(f"Event {event_id} not found")

    if event.status in TERMINAL_STATES:
        logger.info(
            "escalation_skipped_event_terminal", event_id=event_id, status=event.status.value
        )
        return

    machine = await session.get(Machine, event.machine_id)
    if not machine:
        raise NotFoundError(f"Machine {event.machine_id} not found")

    recipient_phone = machine.backup_phone or machine.supervisor_phone
    message = (
        f"CRITICAL ESCALATION: Machine '{machine.name}' vibration anomaly "
        f"({event.rms_g:.2f}g) was not acknowledged after multiple calls. "
        f"Immediate inspection required."
    )

    # 1. Send SMS notification
    await send_sms(recipient_phone, message)

    # 2. Transition event to ESCALATED
    await apply_transition(
        session=session,
        event_id=event.id,
        to_status=EventStatus.ESCALATED,
        actor="system_escalation",
        reason="calls_exhausted_sms_dispatched",
    )
    await session.commit()

    # 3. Publish live update
    await publish_event_updated(
        event_id=event.id,
        machine_id=machine.id,
        status=EventStatus.ESCALATED.value,
        owner_id=machine.owner_id,
    )
    logger.info("escalation_completed", event_id=event_id, to=recipient_phone)
