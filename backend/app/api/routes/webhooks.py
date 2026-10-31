"""Webhook endpoints per ARCHITECTURE.md §3.4 and §3.5."""

import json

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.clients.bolna import normalize_bolna_webhook, verify_bolna_signature
from app.config import settings
from app.errors import WebhookSignatureInvalidError
from app.logging import get_logger
from app.services.calls import process_call_webhook

router = APIRouter(prefix="/v1/webhooks", tags=["webhooks"])
logger = get_logger("webhooks_route")


@router.post("/bolna")
async def bolna_webhook(
    request: Request,
    session: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Receive call outcome from Bolna and update event state."""
    raw_body = await request.body()
    signature_header = request.headers.get(settings.BOLNA_SIGNATURE_HEADER)

    # 1. HMAC check over the raw body BEFORE parsing
    if not verify_bolna_signature(raw_body, signature_header):
        logger.warning("invalid_webhook_signature", header=settings.BOLNA_SIGNATURE_HEADER)
        raise WebhookSignatureInvalidError(
            message="Invalid webhook signature.",
            details={"header": settings.BOLNA_SIGNATURE_HEADER},
        )

    # 2. Parse body and normalize into CallResult
    try:
        body = json.loads(raw_body.decode("utf-8"))
    except Exception as exc:
        logger.error("webhook_json_decode_error", error=str(exc))
        return {"received": True}

    call_result = normalize_bolna_webhook(body)

    # 3. Process result and update call attempt / event state
    await process_call_webhook(session, call_result)
    return {"received": True}
