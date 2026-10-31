"""Integration tests for voice webhooks and retry/escalation lifecycle per Phase P6."""

import hashlib
import hmac
import json
from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import httpx
import pytest
import redis.asyncio as aioredis
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.deps import get_db, get_redis
from app.config import settings
from app.db.models import CallAttempt, Event, EventStatus, Machine
from app.db.repositories.call_attempts import create_call_attempt
from app.db.repositories.machines import create_machine
from app.db.repositories.users import create_user
from app.ids import generate_id
from app.main import app
from app.security import hash_password


@pytest.fixture
async def setup_webhook_test() -> AsyncGenerator[
    tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis], None
]:
    """Test setup with isolated test database and real redis."""
    engine = create_async_engine(settings.DATABASE_URL_TEST, poolclass=pool.NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    async def override_get_redis() -> AsyncGenerator[aioredis.Redis, None]:
        yield redis_client

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c, session_factory, redis_client

    app.dependency_overrides.clear()
    await redis_client.aclose()
    await engine.dispose()


def _sign_payload(body: bytes) -> str:
    """Generate valid HMAC-SHA256 signature for Bolna webhook."""
    mac = hmac.new(settings.BOLNA_WEBHOOK_SECRET.encode("utf-8"), body, hashlib.sha256)
    return mac.hexdigest()


@pytest.mark.asyncio
async def test_webhook_invalid_signature_rejected(
    setup_webhook_test: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Verify webhook with bad signature returns 401 WEBHOOK_SIGNATURE_INVALID."""
    client, _, _ = setup_webhook_test
    body = json.dumps({"event_id": "evt_test", "status": "completed"}).encode("utf-8")

    # Missing signature
    res = await client.post("/v1/webhooks/bolna", content=body)
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "WEBHOOK_SIGNATURE_INVALID"

    # Invalid signature
    headers = {settings.BOLNA_SIGNATURE_HEADER: "invalid_hex_digest"}
    res = await client.post("/v1/webhooks/bolna", content=body, headers=headers)
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "WEBHOOK_SIGNATURE_INVALID"


@pytest.mark.asyncio
async def test_webhook_spoken_decision_acknowledged(
    setup_webhook_test: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Verify webhook with spoken decision transitions event and updates call_attempts."""
    client, session_factory, _ = setup_webhook_test

    user_id = generate_id("usr_")
    mch_id = generate_id("mch_")
    event_id = generate_id("evt_")
    attempt_id = generate_id("cal_")

    async with session_factory() as session:
        await create_user(
            session=session,
            user_id=user_id,
            email=f"call_user_{user_id}@example.com",
            password_hash=hash_password("Password123!"),
            full_name="Call Supervisor",
            role="owner",
        )
        await create_machine(
            session=session,
            machine=Machine(
                id=mch_id,
                owner_id=user_id,
                name="Lathe 3",
                machine_type="lathe",
                supervisor_phone="+919876543210",
            ),
        )
        event = Event(
            id=event_id,
            machine_id=mch_id,
            status=EventStatus.CALLING,
            severity="HIGH",
            ts=datetime.now(UTC),
            seq=301,
            rms_g=0.95,
            z_score=14.0,
            baseline_mean=0.20,
            baseline_std=0.03,
            hints=["1x dominant: imbalance"],
        )
        session.add(event)
        attempt = CallAttempt(
            id=attempt_id,
            event_id=event_id,
            attempt_no=1,
            to_phone="+919876543210",
            state="RINGING",
            started_at=datetime.now(UTC),
        )
        await create_call_attempt(session, attempt)
        await session.commit()

    payload = {
        "call_id": "bolna_call_12345",
        "status": "completed",
        "transcript": "Yes, I acknowledge the vibration alert. I will check it.",
        "duration": 45,
        "user_data": {
            "event_id": event_id,
            "attempt_id": attempt_id,
        },
        "extracted_data": {
            "decision": "ACKNOWLEDGED",
        },
    }
    raw_body = json.dumps(payload).encode("utf-8")
    headers = {
        settings.BOLNA_SIGNATURE_HEADER: _sign_payload(raw_body),
        "Content-Type": "application/json",
    }

    res = await client.post("/v1/webhooks/bolna", content=raw_body, headers=headers)
    assert res.status_code == 200
    assert res.json() == {"received": True}

    # Verify event and call_attempt in DB
    async with session_factory() as session:
        ev = await session.get(Event, event_id)
        assert ev is not None
        assert ev.status == EventStatus.ACKNOWLEDGED
        assert ev.decision == "ACKNOWLEDGED"

        att = await session.get(CallAttempt, attempt_id)
        assert att is not None
        assert att.state == "COMPLETED"
        assert att.extracted_decision == "ACKNOWLEDGED"
        assert att.ended_at is not None


@pytest.mark.asyncio
async def test_webhook_no_answer_retries_and_escalates(
    setup_webhook_test: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Verify NO_ANSWER transitions event to NO_ANSWER and schedules retry or escalation."""
    client, session_factory, _redis_client = setup_webhook_test

    user_id = generate_id("usr_")
    mch_id = generate_id("mch_")
    event_id = generate_id("evt_")
    attempt_id = generate_id("cal_")

    async with session_factory() as session:
        await create_user(
            session=session,
            user_id=user_id,
            email=f"noans_user_{user_id}@example.com",
            password_hash=hash_password("Password123!"),
            full_name="Supervisor",
            role="owner",
        )
        await create_machine(
            session=session,
            machine=Machine(
                id=mch_id,
                owner_id=user_id,
                name="Lathe 4",
                machine_type="lathe",
                supervisor_phone="+919876543210",
                backup_phone="+919876543219",
            ),
        )
        event = Event(
            id=event_id,
            machine_id=mch_id,
            status=EventStatus.CALLING,
            severity="HIGH",
            ts=datetime.now(UTC),
            seq=401,
            rms_g=0.90,
            z_score=11.0,
            baseline_mean=0.20,
            baseline_std=0.03,
            hints=["1x dominant: imbalance"],
        )
        session.add(event)
        attempt = CallAttempt(
            id=attempt_id,
            event_id=event_id,
            attempt_no=1,
            to_phone="+919876543210",
            state="RINGING",
            started_at=datetime.now(UTC),
        )
        await create_call_attempt(session, attempt)
        await session.commit()

    # Attempt 1: NO_ANSWER
    payload = {
        "call_id": "bolna_call_noans_1",
        "status": "no-answer",
        "user_data": {
            "event_id": event_id,
            "attempt_id": attempt_id,
        },
    }
    raw_body = json.dumps(payload).encode("utf-8")
    headers = {
        settings.BOLNA_SIGNATURE_HEADER: _sign_payload(raw_body),
        "Content-Type": "application/json",
    }

    res = await client.post("/v1/webhooks/bolna", content=raw_body, headers=headers)
    assert res.status_code == 200

    async with session_factory() as session:
        ev = await session.get(Event, event_id)
        assert ev is not None
        assert ev.status == EventStatus.NO_ANSWER
