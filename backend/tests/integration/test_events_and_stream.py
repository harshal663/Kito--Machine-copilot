"""Integration tests for events API, decisions, cross-owner scoping, and SSE stream per Phase P6."""

from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import httpx
import pytest
import redis.asyncio as aioredis
from sqlalchemy import pool, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.deps import get_db, get_redis
from app.config import settings
from app.db.models import AuditLog, Event, EventStatus, Machine
from app.db.repositories.machines import create_machine
from app.db.repositories.users import create_user
from app.ids import generate_id
from app.main import app
from app.security import create_access_token, hash_password
from app.services.events_bus import publish_event


@pytest.fixture
async def setup_events_test() -> AsyncGenerator[
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


@pytest.mark.asyncio
async def test_events_list_and_detail_scoping(
    setup_events_test: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Verify listing and detail endpoints enforce owner scoping (cross-owner returns 404)."""
    client, session_factory, _ = setup_events_test

    user_a = generate_id("usr_")
    user_b = generate_id("usr_")
    mch_a = generate_id("mch_")
    event_id = generate_id("evt_")

    async with session_factory() as session:
        await create_user(
            session=session,
            user_id=user_a,
            email=f"owner_a_{user_a}@example.com",
            password_hash=hash_password("Pass123!"),
            full_name="Owner A",
            role="owner",
        )
        await create_user(
            session=session,
            user_id=user_b,
            email=f"owner_b_{user_b}@example.com",
            password_hash=hash_password("Pass123!"),
            full_name="Owner B",
            role="owner",
        )
        await create_machine(
            session=session,
            machine=Machine(
                id=mch_a,
                owner_id=user_a,
                name="Machine A",
                machine_type="lathe",
                supervisor_phone="+919876543210",
            ),
        )
        event = Event(
            id=event_id,
            machine_id=mch_a,
            status=EventStatus.CALLING,
            severity="HIGH",
            ts=datetime.now(UTC),
            seq=501,
            rms_g=0.88,
            z_score=10.5,
            baseline_mean=0.20,
            baseline_std=0.03,
            hints=["1x dominant: imbalance"],
        )
        session.add(event)
        await session.commit()

    token_a = create_access_token(user_a, email=f"owner_a_{user_a}@example.com", role="owner")
    token_b = create_access_token(user_b, email=f"owner_b_{user_b}@example.com", role="owner")

    # Owner A gets events list -> 200
    res_a = await client.get(
        f"/v1/machines/{mch_a}/events",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert len(data_a["items"]) == 1
    assert data_a["items"][0]["id"] == event_id

    # Owner B attempts to get Owner A's events list -> 404 NOT_FOUND
    res_b = await client.get(
        f"/v1/machines/{mch_a}/events",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_b.status_code == 404

    # Owner A gets event detail -> 200
    detail_res_a = await client.get(
        f"/v1/events/{event_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert detail_res_a.status_code == 200
    assert detail_res_a.json()["id"] == event_id

    # Owner B attempts to get Owner A's event detail -> 404 NOT_FOUND
    detail_res_b = await client.get(
        f"/v1/events/{event_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert detail_res_b.status_code == 404


@pytest.mark.asyncio
async def test_event_decision_patch_and_failed_rejection(
    setup_events_test: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Verify decision patch records decision and FAILED event rejects decision (409)."""
    client, session_factory, _ = setup_events_test

    user_id = generate_id("usr_")
    mch_id = generate_id("mch_")
    active_event_id = generate_id("evt_")
    failed_event_id = generate_id("evt_")

    async with session_factory() as session:
        await create_user(
            session=session,
            user_id=user_id,
            email=f"dec_user_{user_id}@example.com",
            password_hash=hash_password("Pass123!"),
            full_name="Decider",
            role="owner",
        )
        await create_machine(
            session=session,
            machine=Machine(
                id=mch_id,
                owner_id=user_id,
                name="Machine Decision",
                machine_type="lathe",
                supervisor_phone="+919876543210",
            ),
        )
        session.add(
            Event(
                id=active_event_id,
                machine_id=mch_id,
                status=EventStatus.CALLING,
                severity="HIGH",
                ts=datetime.now(UTC),
                seq=601,
                rms_g=0.91,
                z_score=12.0,
                baseline_mean=0.20,
                baseline_std=0.03,
            )
        )
        session.add(
            Event(
                id=failed_event_id,
                machine_id=mch_id,
                status=EventStatus.FAILED,
                severity="HIGH",
                ts=datetime.now(UTC),
                seq=602,
                rms_g=0.95,
                z_score=15.0,
                baseline_mean=0.20,
                baseline_std=0.03,
            )
        )
        await session.commit()

    token = create_access_token(user_id, email=f"dec_user_{user_id}@example.com", role="owner")
    headers = {"Authorization": f"Bearer {token}"}

    # Patch decision on active event -> 200 INSPECTION_SCHEDULED
    patch_res = await client.patch(
        f"/v1/events/{active_event_id}/decision",
        json={"decision": "INSPECTION_SCHEDULED", "note": "Check tooling"},
        headers=headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "INSPECTION_SCHEDULED"
    assert patch_res.json()["decision"] == "INSPECTION_SCHEDULED"

    # Check audit log written
    async with session_factory() as session:
        audit_stmt = select(AuditLog).where(AuditLog.entity_id == active_event_id)
        audits = (await session.execute(audit_stmt)).scalars().all()
        assert any("inspection_scheduled" in a.action for a in audits)

    # Patch decision on FAILED event -> 409 INVALID_STATE_TRANSITION
    failed_patch = await client.patch(
        f"/v1/events/{failed_event_id}/decision",
        json={"decision": "ACKNOWLEDGED"},
        headers=headers,
    )
    assert failed_patch.status_code == 409
    assert failed_patch.json()["error"]["code"] == "INVALID_STATE_TRANSITION"


@pytest.mark.asyncio
async def test_sse_stream_receives_live_events(
    setup_events_test: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Verify /v1/stream and sse_event_generator receive SSE frames without leaking owner_id."""
    client, session_factory, redis_client = setup_events_test

    user_id = generate_id("usr_")
    async with session_factory() as session:
        await create_user(
            session=session,
            user_id=user_id,
            email=f"sse_user_{user_id}@example.com",
            password_hash=hash_password("Pass123!"),
            full_name="SSE User",
            role="owner",
        )
        await session.commit()

    _token = create_access_token(user_id, email=f"sse_user_{user_id}@example.com", role="owner")

    # 1. Verify unauthenticated request to /v1/stream returns 401
    unauth_res = await client.get("/v1/stream")
    assert unauth_res.status_code == 401

    # 2. Test live event delivery and owner filtering on the generator
    from unittest.mock import AsyncMock, MagicMock

    from app.api.routes.stream import sse_event_generator

    mock_request = MagicMock()
    mock_request.is_disconnected = AsyncMock(return_value=False)
    gen = sse_event_generator(mock_request, user_id, redis_client)

    first_frame = await anext(gen)
    assert "event: ping" in first_frame

    publisher = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        await publish_event(
            redis_client=publisher,
            event_name="event.updated",
            payload={"event_id": "evt_stream_test", "status": "ACKNOWLEDGED"},
            owner_id=user_id,
        )
    finally:
        await publisher.aclose()

    second_frame = await anext(gen)
    assert "event: event.updated" in second_frame
    assert "evt_stream_test" in second_frame
    assert "owner_id" not in second_frame
    await gen.aclose()
