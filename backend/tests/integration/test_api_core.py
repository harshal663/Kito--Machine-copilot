"""Integration tests for API Core: Auth, Machines, Devices, Ownership per Phase P3."""

from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import httpx
import pytest
import redis.asyncio as aioredis
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.deps import get_db, get_redis
from app.config import settings
from app.db.repositories.users import create_user
from app.ids import generate_id
from app.main import app
from app.security import hash_password


@pytest.fixture
async def client_and_session() -> AsyncGenerator[
    tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]], None
]:
    """Test client with isolated engine and Redis connection per test."""
    engine = create_async_engine(settings.DATABASE_URL_TEST, poolclass=pool.NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    redis_pool = aioredis.ConnectionPool.from_url(settings.REDIS_URL, decode_responses=True)

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    async def override_get_redis() -> AsyncGenerator[aioredis.Redis, None]:
        r = aioredis.Redis(connection_pool=redis_pool)
        try:
            yield r
        finally:
            await r.aclose()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c, session_factory

    app.dependency_overrides.clear()
    await redis_pool.disconnect()
    await engine.dispose()


async def test_login_success_and_failure(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    """Verify user login success and failure branches."""
    client, session_factory = client_and_session
    user_id = generate_id("usr_")
    email = f"user_{user_id.lower()}@example.com"
    password = "CorrectPassword123!"

    async with session_factory() as session:
        await create_user(
            session=session,
            user_id=user_id,
            email=email,
            password_hash=hash_password(password),
            full_name="Owner User",
            role="owner",
        )
        await session.commit()

    # Success
    res = await client.post("/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["email"] == email
    assert data["role"] == "owner"

    # Wrong password
    res_bad = await client.post(
        "/v1/auth/login", json={"email": email, "password": "WrongPassword"}
    )
    assert res_bad.status_code == 401
    assert res_bad.json()["error"]["code"] == "UNAUTHENTICATED"

    # Non-existent email
    res_no = await client.post(
        "/v1/auth/login", json={"email": "nobody@example.com", "password": password}
    )
    assert res_no.status_code == 401
    assert res_no.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_machine_lifecycle_and_device_binding(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    """Verify machine creation, device binding returning key once, conflict, and config."""
    client, session_factory = client_and_session
    user_id = generate_id("usr_")
    email = f"owner_{user_id}@example.com"
    password = "SecretPassword123!"

    async with session_factory() as session:
        await create_user(
            session=session,
            user_id=user_id,
            email=email,
            password_hash=hash_password(password),
            full_name="Owner A",
            role="owner",
        )
        await session.commit()

    login_res = await client.post("/v1/auth/login", json={"email": email, "password": password})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Machine
    mch_res = await client.post(
        "/v1/machines",
        headers=headers,
        json={
            "name": "Milling Machine 1",
            "machine_type": "milling",
            "supervisor_name": "Ramesh",
            "supervisor_phone": "+919800000000",
            "language": "en",
        },
    )
    assert mch_res.status_code == 201
    mch_data = mch_res.json()
    machine_id = mch_data["id"]
    assert mch_data["status"] == "LEARNING"
    assert mch_data["device_online"] is False

    # 2. Bind Device - returns key once
    dev_res = await client.post(
        "/v1/devices",
        headers=headers,
        json={"machine_id": machine_id},
    )
    assert dev_res.status_code == 201
    dev_data = dev_res.json()
    device_id = dev_data["device_id"]
    device_key = dev_data["device_key"]
    assert device_key.startswith("dk_")

    # 3. Second bind attempt returns CONFLICT (409)
    dev_conflict = await client.post(
        "/v1/devices",
        headers=headers,
        json={"machine_id": machine_id},
    )
    assert dev_conflict.status_code == 409
    assert dev_conflict.json()["error"]["code"] == "CONFLICT"

    # 4. Device config with valid key
    cfg_res = await client.get("/v1/devices/me/config", headers={"X-Device-Key": device_key})
    assert cfg_res.status_code == 200
    cfg_data = cfg_res.json()
    assert cfg_data["machine_id"] == machine_id
    assert cfg_data["sampling"]["fs"] == 1000

    # 5. Device config with invalid key returns DEVICE_KEY_INVALID (401)
    cfg_bad = await client.get(
        "/v1/devices/me/config", headers={"X-Device-Key": "dk_invalid_key_value"}
    )
    assert cfg_bad.status_code == 401
    assert cfg_bad.json()["error"]["code"] == "DEVICE_KEY_INVALID"

    # 6. Device Heartbeat
    now_iso = datetime.now(UTC).isoformat()
    hb_res = await client.post(
        "/v1/devices/heartbeat",
        headers={"X-Device-Key": device_key},
        json={
            "device_id": device_id,
            "machine_id": machine_id,
            "fw": "1.0.0",
            "mode": "LEARNING",
            "errors_since_boot": 0,
            "ts": now_iso,
        },
    )
    assert hb_res.status_code == 204

    # Machine should now report device_online = True
    mch_check = await client.get(f"/v1/machines/{machine_id}", headers=headers)
    assert mch_check.status_code == 200
    assert mch_check.json()["device_online"] is True


async def test_owner_scoping_isolation(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    """Verify cross-owner access returns NOT_FOUND (404), never FORBIDDEN (403)."""
    client, session_factory = client_and_session

    user_a = generate_id("usr_")
    user_b = generate_id("usr_")
    async with session_factory() as session:
        await create_user(
            session, user_a, f"a_{user_a}@example.com", hash_password("passA123!"), "A", "owner"
        )
        await create_user(
            session, user_b, f"b_{user_b}@example.com", hash_password("passB123!"), "B", "owner"
        )
        await session.commit()

    token_a = (
        await client.post(
            "/v1/auth/login", json={"email": f"a_{user_a}@example.com", "password": "passA123!"}
        )
    ).json()["access_token"]
    token_b = (
        await client.post(
            "/v1/auth/login", json={"email": f"b_{user_b}@example.com", "password": "passB123!"}
        )
    ).json()["access_token"]

    # Owner A creates machine
    mch = await client.post(
        "/v1/machines",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "name": "Machine A",
            "machine_type": "press",
            "supervisor_phone": "+919800000000",
        },
    )
    machine_id = mch.json()["id"]

    # Owner B tries to read Owner A's machine -> MUST be 404 NOT_FOUND
    res_b = await client.get(
        f"/v1/machines/{machine_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_b.status_code == 404
    assert res_b.json()["error"]["code"] == "NOT_FOUND"


async def test_health_probes(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    """Verify /healthz and /readyz."""
    client, _ = client_and_session
    hz = await client.get("/healthz")
    assert hz.status_code == 200
    assert hz.json()["status"] == "ok"

    rz = await client.get("/readyz")
    assert rz.status_code == 200
    assert rz.json()["database"] == "ok"
    assert rz.json()["redis"] == "ok"
