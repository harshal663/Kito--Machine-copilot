"""Twilio notification client per ARCHITECTURE.md §4.1 and §6.4."""

import json
from typing import Any

import httpx
import redis.asyncio as aioredis

from app.api.deps import get_redis_pool
from app.config import settings
from app.errors import NotifyProviderError
from app.logging import get_logger

logger = get_logger("twilio_client")

_mock_notifications: list[dict[str, Any]] = []


def get_mock_notifications() -> list[dict[str, Any]]:
    """Return recorded mock notifications."""
    return list(_mock_notifications)


async def send_sms(to_phone: str, message: str) -> bool:
    """Send SMS notification via Twilio or record to mock list."""
    if settings.MOCK_EXTERNALS or settings.NOTIFY_PROVIDER == "mock":
        record = {
            "to_phone": to_phone,
            "message": message,
        }
        _mock_notifications.append(record)
        logger.info("mock_notification_sent", to=to_phone, message=message[:60])
        try:
            redis_client = aioredis.Redis(connection_pool=get_redis_pool())
            await redis_client.rpush("mock:notifications", json.dumps(record))  # type: ignore[misc]
        except Exception as exc:
            logger.warning("mock_notifications_redis_push_failed", error=str(exc))
        return True

    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    data = {
        "To": to_phone,
        "From": settings.TWILIO_FROM_NUMBER,
        "Body": message,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.post(
                url,
                data=data,
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
            )
            response.raise_for_status()
            logger.info("twilio_sms_sent_successfully", to=to_phone)
            return True
        except Exception as exc:
            logger.error("twilio_sms_failed", error=str(exc), to=to_phone)
            raise NotifyProviderError("Failed to deliver SMS via Twilio") from exc
