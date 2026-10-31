"""Live server-sent events stream endpoint per ARCHITECTURE.md §3.7."""

import asyncio
import json
from collections.abc import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.api.deps import get_current_user, get_redis
from app.db.models import User
from app.logging import get_logger

router = APIRouter(tags=["stream"])
logger = get_logger("stream_route")

SSE_CHANNEL = "sse.events"
PING_INTERVAL_S = 25.0


async def sse_event_generator(
    request: Request,
    user_id: str,
    redis_client: aioredis.Redis,
) -> AsyncGenerator[str, None]:
    """Yield Server-Sent Events from Redis pub/sub filtered for user_id with 25s ping."""
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(SSE_CHANNEL)

    logger.info("sse_client_connected", user_id=user_id)
    # Send immediate initial ping to confirm subscription and stream readiness
    yield "event: ping\ndata: {}\n\n"

    try:
        while True:
            if await request.is_disconnected():
                logger.info("sse_client_disconnected", user_id=user_id)
                break

            try:
                message = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                    timeout=PING_INTERVAL_S,
                )
                if not message or message.get("type") != "message":
                    await asyncio.sleep(0.1)
                    continue

                raw_data = message.get("data", "")
                if isinstance(raw_data, bytes):
                    raw_data = raw_data.decode("utf-8")
                parsed = json.loads(raw_data)
                owner_id = parsed.get("owner_id", "")
                event_name = parsed.get("event", "message")
                data_payload = parsed.get("data", {})

                if not owner_id or owner_id == user_id:
                    yield f"event: {event_name}\ndata: {json.dumps(data_payload)}\n\n"
            except TimeoutError:
                yield "event: ping\ndata: {}\n\n"
            except asyncio.CancelledError:
                break
    finally:
        try:
            await pubsub.unsubscribe(SSE_CHANNEL)
            await pubsub.aclose()  # type: ignore[no-untyped-call]
        except Exception as exc:
            logger.debug("sse_cleanup_exception", error=str(exc))


@router.get("/v1/stream")
async def stream_live_updates(
    request: Request,
    current_user: User = Depends(get_current_user),
    redis_client: aioredis.Redis = Depends(get_redis),
) -> StreamingResponse:
    """Stream live server-sent events for machines and alerts."""
    return StreamingResponse(
        sse_event_generator(request, current_user.id, redis_client),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
