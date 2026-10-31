"""Comprehensive Security Test Suite per docs/Security Tests.md.

Validates S-01 through S-29:
- 1.1 Authentication (S-01 to S-09, Logout revocation, Reset password)
- 1.2 Authorization & Owner Isolation (S-10 to S-16)
- 1.3 Device Authentication & Telemetry (S-20 to S-29)
"""

import sys
import time
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import jwt
import pytest
import redis.asyncio as aioredis
from sqlalchemy import func, pool, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.deps import get_db, get_redis
from app.config import settings
from app.db.models import AuditLog, Device, Event, EventStatus, Machine, Manual, User
from app.ids import generate_id
from app.main import app
from app.security import (
    create_access_token,
    generate_device_key,
    hash_device_key,
    hash_password,
)

# Allow importing helper scripts
_SCRIPTS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "scripts"
sys.path.insert(0, str(_SCRIPTS_DIR))
from reset_password import reset_password  # noqa: E402


@pytest.fixture
async def client_and_session() -> AsyncGenerator[
    tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis], None
]:
    """Test client with isolated NullPool database engine and Redis client."""
    engine = create_async_engine(settings.DATABASE_URL_TEST, poolclass=pool.NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    redis_pool = aioredis.ConnectionPool.from_url(settings.REDIS_URL, decode_responses=True)
    redis_client = aioredis.Redis(connection_pool=redis_pool)

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
    await redis_pool.disconnect()
    await engine.dispose()


# =============================================================================
# 1.1 Authentication Tests (S-01 to S-09)
# =============================================================================


@pytest.mark.asyncio
async def test_s01_login_success(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """S-01: Login with correct credentials returns 200 with access_token."""
    client, session_factory, _ = client_and_session
    user_id = generate_id("usr_")
    email = f"s01_{user_id.lower()}@example.com"
    password = "CorrectPassword123!"

    async with session_factory() as session:
        session.add(
            User(
                id=user_id,
                email=email,
                password_hash=hash_password(password),
                full_name="S01 User",
                role="owner",
            )
        )
        await session.commit()

    resp = await client.post("/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["email"] == email


@pytest.mark.asyncio
async def test_s02_login_wrong_password(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """S-02: Login with wrong password returns 401 UNAUTHENTICATED with generic message."""
    client, session_factory, _ = client_and_session
    user_id = generate_id("usr_")
    email = f"s02_{user_id.lower()}@example.com"
    password = "RealPassword123!"

    async with session_factory() as session:
        session.add(
            User(
                id=user_id,
                email=email,
                password_hash=hash_password(password),
                full_name="S02 User",
                role="owner",
            )
        )
        await session.commit()

    resp = await client.post(
        "/v1/auth/login", json={"email": email, "password": "WrongPassword456!"}
    )
    assert resp.status_code == 401
    err = resp.json()["error"]
    assert err["code"] == "UNAUTHENTICATED"
    assert err["message"] == "Invalid email or password."


@pytest.mark.asyncio
async def test_s03_login_unknown_email_timing_protection(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """S-03: Unknown email returns 401 UNAUTHENTICATED with constant-time dummy verification."""
    client, _, _ = client_and_session
    unknown_email = f"unknown_{generate_id('usr_').lower()}@example.com"

    t0 = time.perf_counter()
    resp = await client.post(
        "/v1/auth/login", json={"email": unknown_email, "password": "AnyPassword123!"}
    )
    t_elapsed = time.perf_counter() - t0

    assert resp.status_code == 401
    err = resp.json()["error"]
    assert err["code"] == "UNAUTHENTICATED"
    assert err["message"] == "Invalid email or password."
    assert t_elapsed > 0.005


@pytest.mark.asyncio
async def test_s04_failed_login_rate_limiting(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """S-04: Five failed logins for one email returns 429 RATE_LIMITED on the next attempt."""
    client, session_factory, redis_client = client_and_session
    user_id = generate_id("usr_")
    email = f"s04_{user_id.lower()}@example.com"
    password = "MyPassword123!"

    async with session_factory() as session:
        session.add(
            User(
                id=user_id,
                email=email,
                password_hash=hash_password(password),
                full_name="S04 User",
                role="owner",
            )
        )
        await session.commit()

    # Clear any leftover rate key
    await redis_client.delete(f"ratelimit:login:failed:{email}")

    # Attempts 1 to 5 fail with 401
    for _ in range(5):
        r = await client.post("/v1/auth/login", json={"email": email, "password": "BadPassword!"})
        assert r.status_code == 401

    # Attempt 6 must be blocked with 429 RATE_LIMITED
    r6 = await client.post("/v1/auth/login", json={"email": email, "password": "BadPassword!"})
    assert r6.status_code == 429
    err = r6.json()["error"]
    assert err["code"] == "RATE_LIMITED"
    assert "locked for 15 minutes" in err["message"]


@pytest.mark.asyncio
async def test_s05_protected_endpoint_no_token(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """S-05: Protected endpoint with no token returns 401 UNAUTHENTICATED."""
    client, _, _ = client_and_session
    resp = await client.get("/v1/machines")
    assert resp.status_code == 401
    err = resp.json()["error"]
    assert err["code"] == "UNAUTHENTICATED"


@pytest.mark.asyncio
async def test_s06_token_tampered_signature(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """S-06: Token with changed payload or tampered signature returns 401 UNAUTHENTICATED."""
    client, _, _ = client_and_session
    token = create_access_token("usr_test", "owner", "test@example.com")
    parts = token.split(".")
    tampered_token = f"{parts[0]}.eyJhZG1pbiI6dHJ1ZX0.{parts[2]}"

    resp = await client.get("/v1/machines", headers={"Authorization": f"Bearer {tampered_token}"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


@pytest.mark.asyncio
async def test_s07_token_alg_none(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """S-07: Token with alg: none is rejected with 401 UNAUTHENTICATED."""
    client, _, _ = client_and_session
    payload = {
        "sub": "usr_hacker",
        "role": "admin",
        "email": "hacker@example.com",
        "iat": int(datetime.now(UTC).timestamp()),
        "exp": int((datetime.now(UTC) + timedelta(hours=1)).timestamp()),
    }
    none_token = jwt.encode(payload, key="", algorithm="none")

    resp = await client.get("/v1/machines", headers={"Authorization": f"Bearer {none_token}"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


@pytest.mark.asyncio
async def test_s08_expired_token(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """S-08: Expired token returns 401 UNAUTHENTICATED."""
    client, _, _ = client_and_session
    expired_token = create_access_token(
        "usr_expired",
        "owner",
        "expired@example.com",
        expires_delta=timedelta(seconds=-3600),
    )
    resp = await client.get("/v1/machines", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


@pytest.mark.asyncio
async def test_s09_token_in_query_string_rejected(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """S-09: Token passed in query string is rejected with 401 UNAUTHENTICATED."""
    client, _, _ = client_and_session
    token = create_access_token("usr_test", "owner", "test@example.com")
    resp = await client.get(f"/v1/machines?token={token}")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


@pytest.mark.asyncio
async def test_auth_logout_revocation(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Additional Auth: POST /v1/auth/logout revokes token and blocks subsequent access."""
    client, session_factory, _ = client_and_session
    user_id = generate_id("usr_")
    email = f"logout_{user_id.lower()}@example.com"
    password = "LogoutPassword123!"

    async with session_factory() as session:
        session.add(
            User(id=user_id, email=email, password_hash=hash_password(password), role="owner")
        )
        await session.commit()

    login_res = await client.post("/v1/auth/login", json={"email": email, "password": password})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # Verify token works
    valid_res = await client.get("/v1/machines", headers=auth_headers)
    assert valid_res.status_code == 200

    # Logout
    logout_res = await client.post("/v1/auth/logout", headers=auth_headers)
    assert logout_res.status_code == 200

    # Subsequent request with revoked token fails with 401
    revoked_res = await client.get("/v1/machines", headers=auth_headers)
    assert revoked_res.status_code == 401
    assert revoked_res.json()["error"]["code"] == "UNAUTHENTICATED"


# =============================================================================
# 1.2 Authorisation (Owner Isolation) Tests (S-10 to S-16)
# =============================================================================


@pytest.mark.asyncio
async def test_s10_to_s16_owner_isolation(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """S-10 to S-16: Full isolation between Owner A and Owner B."""
    client, session_factory, _ = client_and_session
    user_a = generate_id("usr_")
    user_b = generate_id("usr_")
    mach_a = generate_id("mch_")
    mach_b = generate_id("mch_")
    evt_a = generate_id("evt_")
    man_a = generate_id("man_")

    async with session_factory() as session:
        session.add(
            User(
                id=user_a,
                email=f"a_{user_a.lower()}@example.com",
                password_hash=hash_password("PassA12345!"),
                role="owner",
            )
        )
        session.add(
            User(
                id=user_b,
                email=f"b_{user_b.lower()}@example.com",
                password_hash=hash_password("PassB12345!"),
                role="owner",
            )
        )

        session.add(
            Machine(
                id=mach_a,
                owner_id=user_a,
                name="Machine A",
                machine_type="Pump",
                supervisor_phone="+919876543210",
            )
        )
        session.add(
            Machine(
                id=mach_b,
                owner_id=user_b,
                name="Machine B",
                machine_type="Lathe",
                supervisor_phone="+919123456780",
            )
        )

        session.add(
            Event(
                id=evt_a,
                machine_id=mach_a,
                status=EventStatus.ANOMALY_DETECTED,
                ts=datetime.now(UTC),
                seq=1,
                rms_g=0.55,
                z_score=15.0,
                baseline_mean=0.12,
                baseline_std=0.018,
                peaks=[{"freq_hz": 24.4, "amp_g": 0.40}],
                hints=["1x imbalance"],
            )
        )

        session.add(
            Manual(
                id=man_a,
                machine_id=mach_a,
                filename="manual_a.pdf",
                status="READY",
                embedding_model="hash",
            )
        )
        await session.commit()

    token_b = create_access_token(user_b, "owner", f"b_{user_b.lower()}@example.com")
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # S-10: Owner B reads Owner A's machine -> 404 NOT_FOUND
    r10 = await client.get(f"/v1/machines/{mach_a}", headers=headers_b)
    assert r10.status_code == 404
    assert r10.json()["error"]["code"] == "NOT_FOUND"

    # S-11: Owner B patches Owner A's machine -> 404 NOT_FOUND
    r11 = await client.patch(
        f"/v1/machines/{mach_a}", headers=headers_b, json={"name": "Hacked Name"}
    )
    assert r11.status_code == 404
    assert r11.json()["error"]["code"] == "NOT_FOUND"

    # S-12: Owner B reads Owner A's event -> 404 NOT_FOUND
    r12 = await client.get(f"/v1/events/{evt_a}", headers=headers_b)
    assert r12.status_code == 404
    assert r12.json()["error"]["code"] == "NOT_FOUND"

    # S-13: Owner B records decision on Owner A's event -> 404 NOT_FOUND, no audit_log written
    r13 = await client.patch(
        f"/v1/events/{evt_a}/decision",
        headers=headers_b,
        json={"decision": "ACKNOWLEDGED", "note": "Hacked"},
    )
    assert r13.status_code == 404
    assert r13.json()["error"]["code"] == "NOT_FOUND"

    async with session_factory() as session:
        audit_res = await session.execute(
            select(AuditLog).where(
                AuditLog.entity_id == evt_a,
                AuditLog.actor == user_b,
            )
        )
        assert audit_res.scalar_one_or_none() is None

    # S-14: Owner B reads Owner A's manual status -> 404 NOT_FOUND
    r14 = await client.get(f"/v1/manuals/{man_a}", headers=headers_b)
    assert r14.status_code == 404
    assert r14.json()["error"]["code"] == "NOT_FOUND"

    # S-16: Owner B lists machines -> Only Owner B's machines appear
    r16 = await client.get("/v1/machines", headers=headers_b)
    assert r16.status_code == 200
    items = r16.json()["items"]
    machine_ids = [m["id"] for m in items]
    assert mach_b in machine_ids
    assert mach_a not in machine_ids


# =============================================================================
# 1.3 Device Authentication and Telemetry Tests (S-20 to S-29)
# =============================================================================


@pytest.mark.asyncio
async def test_s20_s21_device_key_auth(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """S-20 & S-21: Missing or unknown X-Device-Key returns 401 DEVICE_KEY_INVALID."""
    client, _, _ = client_and_session

    # S-20: Missing header
    r20 = await client.post("/v1/telemetry", json={})
    assert r20.status_code == 401
    assert r20.json()["error"]["code"] == "DEVICE_KEY_INVALID"

    # S-21: Unknown key
    r21 = await client.post(
        "/v1/telemetry", headers={"X-Device-Key": "dk_unknownkey1234567890123456789012"}, json={}
    )
    assert r21.status_code == 401
    assert r21.json()["error"]["code"] == "DEVICE_KEY_INVALID"


@pytest.mark.asyncio
async def test_s22_cross_machine_binding_forbidden(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """S-22: Telemetry sent for unbound machine_id returns 403 FORBIDDEN."""
    client, session_factory, _ = client_and_session
    user_id = generate_id("usr_")
    mch_a = generate_id("mch_")
    mch_b = generate_id("mch_")
    dev_a = generate_id("dev_")
    raw_key = generate_device_key()

    async with session_factory() as session:
        session.add(
            User(
                id=user_id,
                email=f"dev_{user_id.lower()}@example.com",
                password_hash=hash_password("Pass123456!"),
                role="owner",
            )
        )
        session.add(
            Machine(
                id=mch_a,
                owner_id=user_id,
                name="Mach A",
                machine_type="Pump",
                supervisor_phone="+919876543210",
            )
        )
        session.add(
            Machine(
                id=mch_b,
                owner_id=user_id,
                name="Mach B",
                machine_type="Pump",
                supervisor_phone="+919876543210",
            )
        )
        session.add(Device(id=dev_a, machine_id=mch_a, key_hash=hash_device_key(raw_key)))
        await session.commit()

    payload = {
        "device_id": dev_a,
        "machine_id": mch_b,  # Wrong machine binding!
        "ts": datetime.now(UTC).isoformat(),
        "seq": 1,
        "fs": 1000,
        "n": 512,
        "rms_g": 0.45,
        "baseline": {"mean": 0.12, "std": 0.018},
        "z_score": 18.0,
        "peaks": [{"freq_hz": 24.4, "amp_g": 0.35}],
        "fw": "1.0.0",
    }
    resp = await client.post("/v1/telemetry", headers={"X-Device-Key": raw_key}, json=payload)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_s23_per_device_rate_limit(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """S-23: Seventh telemetry request in one minute from one device returns 429 RATE_LIMITED."""
    client, session_factory, redis_client = client_and_session
    user_id = generate_id("usr_")
    mch_id = generate_id("mch_")
    dev_id = generate_id("dev_")
    raw_key = generate_device_key()

    async with session_factory() as session:
        session.add(
            User(
                id=user_id,
                email=f"rl_{user_id.lower()}@example.com",
                password_hash=hash_password("Pass123456!"),
                role="owner",
            )
        )
        session.add(
            Machine(
                id=mch_id,
                owner_id=user_id,
                name="Mach RL",
                machine_type="Fan",
                supervisor_phone="+919876543210",
            )
        )
        session.add(Device(id=dev_id, machine_id=mch_id, key_hash=hash_device_key(raw_key)))
        await session.commit()

    minute_str = datetime.now(UTC).strftime("%Y%m%d%H%M")
    await redis_client.delete(f"ratelimit:device:{dev_id}:{minute_str}")

    def make_payload(seq: int) -> dict:
        return {
            "device_id": dev_id,
            "machine_id": mch_id,
            "ts": datetime.now(UTC).isoformat(),
            "seq": seq,
            "fs": 1000,
            "n": 512,
            "rms_g": 0.45,
            "baseline": {"mean": 0.12, "std": 0.018},
            "z_score": 18.0,
            "peaks": [{"freq_hz": 24.4, "amp_g": 0.35}],
            "fw": "1.0.0",
        }

    # First 6 succeed (either 202 accepted or 202 suppressed by cooldown)
    for i in range(1, 7):
        r = await client.post(
            "/v1/telemetry", headers={"X-Device-Key": raw_key}, json=make_payload(i)
        )
        assert r.status_code == 202

    # 7th request must be rate limited with 429
    r7 = await client.post("/v1/telemetry", headers={"X-Device-Key": raw_key}, json=make_payload(7))
    assert r7.status_code == 429
    assert r7.json()["error"]["code"] == "RATE_LIMITED"


@pytest.mark.asyncio
async def test_s24_to_s26_telemetry_schema_validation(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """S-24, S-25, S-26: Extra field, rms_g=1000, 6 peaks return 422 VALIDATION_ERROR."""
    client, session_factory, _ = client_and_session
    user_id = generate_id("usr_")
    mch_id = generate_id("mch_")
    dev_id = generate_id("dev_")
    raw_key = generate_device_key()

    async with session_factory() as session:
        session.add(
            User(
                id=user_id,
                email=f"val_{user_id.lower()}@example.com",
                password_hash=hash_password("Pass123456!"),
                role="owner",
            )
        )
        session.add(
            Machine(
                id=mch_id,
                owner_id=user_id,
                name="Mach Val",
                machine_type="Pump",
                supervisor_phone="+919876543210",
            )
        )
        session.add(Device(id=dev_id, machine_id=mch_id, key_hash=hash_device_key(raw_key)))
        await session.commit()

    headers = {"X-Device-Key": raw_key}
    base_payload = {
        "device_id": dev_id,
        "machine_id": mch_id,
        "ts": datetime.now(UTC).isoformat(),
        "seq": 1,
        "fs": 1000,
        "n": 512,
        "rms_g": 0.45,
        "baseline": {"mean": 0.12, "std": 0.018},
        "z_score": 18.0,
        "peaks": [{"freq_hz": 24.4, "amp_g": 0.35}],
        "fw": "1.0.0",
    }

    # S-24: Extra field
    p24 = {**base_payload, "unexpected_extra_field": "injected"}
    r24 = await client.post("/v1/telemetry", headers=headers, json=p24)
    assert r24.status_code == 422
    assert r24.json()["error"]["code"] == "VALIDATION_ERROR"

    # S-25: rms_g of 1000 (exceeds le=64)
    p25 = {**base_payload, "rms_g": 1000.0}
    r25 = await client.post("/v1/telemetry", headers=headers, json=p25)
    assert r25.status_code == 422
    assert r25.json()["error"]["code"] == "VALIDATION_ERROR"

    # S-26: 6 peaks (exceeds max_length=5)
    p26 = {
        **base_payload,
        "peaks": [{"freq_hz": 10.0 * i, "amp_g": 0.1} for i in range(1, 7)],
    }
    r26 = await client.post("/v1/telemetry", headers=headers, json=p26)
    assert r26.status_code == 422
    assert r26.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_s27_oversized_payload_rejected(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """S-27: Telemetry body larger than 16 KB is rejected with 422 VALIDATION_ERROR."""
    client, session_factory, _ = client_and_session
    user_id = generate_id("usr_")
    mch_id = generate_id("mch_")
    dev_id = generate_id("dev_")
    raw_key = generate_device_key()

    async with session_factory() as session:
        session.add(
            User(
                id=user_id,
                email=f"big_{user_id.lower()}@example.com",
                password_hash=hash_password("Pass123456!"),
                role="owner",
            )
        )
        session.add(
            Machine(
                id=mch_id,
                owner_id=user_id,
                name="Mach Big",
                machine_type="Pump",
                supervisor_phone="+919876543210",
            )
        )
        session.add(Device(id=dev_id, machine_id=mch_id, key_hash=hash_device_key(raw_key)))
        await session.commit()

    headers = {"X-Device-Key": raw_key, "Content-Type": "application/json"}
    huge_payload_bytes = b"{" + b'"padding":"' + b"A" * (17 * 1024) + b'"}'

    resp = await client.post("/v1/telemetry", headers=headers, content=huge_payload_bytes)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_s28_and_s29_device_key_lifecycle_and_storage(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """S-28 & S-29: Device key returned only once, stored as 64-char hex hash."""
    client, session_factory, _ = client_and_session
    user_id = generate_id("usr_")
    mch_id = generate_id("mch_")
    email = f"key_{user_id.lower()}@example.com"
    password = "KeyPassword123!"

    async with session_factory() as session:
        session.add(
            User(id=user_id, email=email, password_hash=hash_password(password), role="owner")
        )
        session.add(
            Machine(
                id=mch_id,
                owner_id=user_id,
                name="Mach Key",
                machine_type="Pump",
                supervisor_phone="+919876543210",
            )
        )
        await session.commit()

    token = create_access_token(user_id, "owner", email)
    auth_headers = {"Authorization": f"Bearer {token}"}

    # Bind device: device_key is returned once
    bind_res = await client.post("/v1/devices", headers=auth_headers, json={"machine_id": mch_id})
    assert bind_res.status_code == 201
    bind_data = bind_res.json()
    device_id = bind_data["device_id"]
    raw_key = bind_data["device_key"]
    assert raw_key.startswith("dk_")

    # S-28: Later GET of machine does not include raw key
    mach_res = await client.get(f"/v1/machines/{mch_id}", headers=auth_headers)
    assert mach_res.status_code == 200
    mach_data = mach_res.json()
    assert "device_key" not in mach_data
    assert "key_hash" not in mach_data

    # S-29: Database holds only 64-character hex hash
    async with session_factory() as session:
        dev = await session.get(Device, device_id)
        assert dev is not None
        assert len(dev.key_hash) == 64
        assert dev.key_hash != raw_key
        assert dev.key_hash == hash_device_key(raw_key)


@pytest.mark.asyncio
async def test_admin_password_reset_script(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Admin password reset script updates password and clears failed login rate limits."""
    client, session_factory, redis_client = client_and_session
    user_id = generate_id("usr_")
    email = f"reset_{user_id.lower()}@example.com"
    old_password = "OldPassword123!"
    new_password = "NewPassword123!"

    async with session_factory() as session:
        session.add(
            User(id=user_id, email=email, password_hash=hash_password(old_password), role="owner")
        )
        await session.commit()

    # Simulate lockout in redis
    await redis_client.set(f"ratelimit:login:failed:{email}", "5", ex=900)

    # Reset password via script function
    success = await reset_password(email, new_password, session_factory=session_factory)
    assert success is True

    # Lockout must be cleared
    assert await redis_client.exists(f"ratelimit:login:failed:{email}") == 0

    # Old password fails with 401
    r_old = await client.post("/v1/auth/login", json={"email": email, "password": old_password})
    assert r_old.status_code == 401

    # New password succeeds with 200
    r_new = await client.post("/v1/auth/login", json={"email": email, "password": new_password})
    assert r_new.status_code == 200
    assert "access_token" in r_new.json()


# =============================================================================
# Run 2 Security & Isolation Tests (Auth, Factory, Onboarding)
# =============================================================================


@pytest.mark.asyncio
async def test_register_duplicate_email_returns_email_taken(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Duplicate email on registration returns 409 EMAIL_TAKEN and writes no second row."""
    client, session_factory, _ = client_and_session
    uid = generate_id("usr_").lower()
    email = f"dup_{uid}@example.com"
    password = "StrongPassword123!"

    # 1. First registration succeeds
    r1 = await client.post(
        "/v1/auth/register",
        json={"email": email, "password": password, "full_name": "First Owner"},
    )
    assert r1.status_code == 201
    assert "access_token" in r1.json()

    # 2. Duplicate registration (with mixed case) returns 409 EMAIL_TAKEN
    r2 = await client.post(
        "/v1/auth/register",
        json={"email": email.upper(), "password": password, "full_name": "Second Owner"},
    )
    assert r2.status_code == 409
    err = r2.json()["error"]
    assert err["code"] == "EMAIL_TAKEN"

    # 3. Exactly one user exists in DB
    async with session_factory() as session:
        result = await session.execute(select(User).where(func.lower(User.email) == email))
        users = result.scalars().all()
        assert len(users) == 1


@pytest.mark.asyncio
async def test_register_weak_password_rejected(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Password with fewer than 10 characters is rejected with 422 VALIDATION_ERROR."""
    client, _, _ = client_and_session
    r = await client.post(
        "/v1/auth/register",
        json={
            "email": f"weak_{generate_id('usr_').lower()}@example.com",
            "password": "short",
            "full_name": "Weak User",
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_login_works_for_account_created_by_register(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Sign-in succeeds with valid credentials for an account created via sign-up."""
    client, _, _ = client_and_session
    uid = generate_id("usr_").lower()
    email = f"reg_{uid}@example.com"
    password = "RegisterPassword123!"

    # Register
    r_reg = await client.post(
        "/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Registered User"},
    )
    assert r_reg.status_code == 201

    # Login
    r_login = await client.post(
        "/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert r_login.status_code == 200
    data = r_login.json()
    assert "access_token" in data
    assert data["email"] == email


@pytest.mark.asyncio
async def test_factory_owner_isolation(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """A user cannot read or change another user's factory."""
    client, _, _ = client_and_session
    uid_a = generate_id("usr_").lower()
    uid_b = generate_id("usr_").lower()

    # User A registers & creates factory
    r_a = await client.post(
        "/v1/auth/register",
        json={"email": f"a_{uid_a}@example.com", "password": "Password123!", "full_name": "User A"},
    )
    token_a = r_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    f_data_a = {
        "name": "Factory Alpha",
        "industry": "CNC Machining",
        "address_line": "123 Industrial Rd",
        "city": "Pune",
        "state": "Maharashtra",
        "pincode": "411001",
        "employee_band": "11-25",
        "gstin": "27AAAAA0000A1Z5",
    }
    r_put_a = await client.put("/v1/factory", headers=headers_a, json=f_data_a)
    assert r_put_a.status_code == 200
    fac_a_id = r_put_a.json()["id"]

    # User B registers
    r_b = await client.post(
        "/v1/auth/register",
        json={"email": f"b_{uid_b}@example.com", "password": "Password123!", "full_name": "User B"},
    )
    token_b = r_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User B reads factory -> 404 NOT_FOUND (does not see User A's factory)
    r_get_b = await client.get("/v1/factory", headers=headers_b)
    assert r_get_b.status_code == 404
    assert r_get_b.json()["error"]["code"] == "NOT_FOUND"

    # User B creates User B's factory
    f_data_b = {
        "name": "Factory Beta",
        "industry": "Foundry",
        "address_line": "456 Casting Ave",
        "city": "Nagpur",
        "state": "Maharashtra",
        "pincode": "440001",
        "employee_band": "26-50",
    }
    r_put_b = await client.put("/v1/factory", headers=headers_b, json=f_data_b)
    assert r_put_b.status_code == 200
    fac_b_id = r_put_b.json()["id"]
    assert fac_b_id != fac_a_id

    # User A reads factory -> still returns User A's factory
    r_get_a = await client.get("/v1/factory", headers=headers_a)
    assert r_get_a.status_code == 200
    assert r_get_a.json()["id"] == fac_a_id
    assert r_get_a.json()["name"] == "Factory Alpha"


@pytest.mark.asyncio
async def test_onboarding_cannot_complete_without_factory(
    client_and_session: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Onboarding cannot complete without factory, and requires machine unless skipped."""
    client, _, _ = client_and_session
    uid = generate_id("usr_").lower()

    # Register user
    r_reg = await client.post(
        "/v1/auth/register",
        json={"email": f"ob_{uid}@example.com", "password": "Password123!", "full_name": "OB User"},
    )
    token = r_reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Attempt complete without factory -> 409 ONBOARDING_INCOMPLETE
    r1 = await client.post(
        "/v1/onboarding/complete",
        headers=headers,
        json={"machines_skipped": True},
    )
    assert r1.status_code == 409
    assert r1.json()["error"]["code"] == "ONBOARDING_INCOMPLETE"

    # 2. Add factory
    f_data = {
        "name": "OB Factory",
        "industry": "Textiles",
        "address_line": "10 Textile Row",
        "city": "Surat",
        "state": "Gujarat",
        "pincode": "395001",
        "employee_band": "1-10",
    }
    r_fac = await client.put("/v1/factory", headers=headers, json=f_data)
    assert r_fac.status_code == 200

    # 3. Attempt complete with machines_skipped=False (no machine registered) -> 409
    r2 = await client.post(
        "/v1/onboarding/complete",
        headers=headers,
        json={"machines_skipped": False},
    )
    assert r2.status_code == 409
    assert r2.json()["error"]["code"] == "ONBOARDING_INCOMPLETE"

    # 4. Complete with machines_skipped=True -> 200 with onboarding_completed=True
    r3 = await client.post(
        "/v1/onboarding/complete",
        headers=headers,
        json={"machines_skipped": True},
    )
    assert r3.status_code == 200
    user_out = r3.json()
    assert user_out["onboarding_completed"] is True
    assert user_out["onboarding_step"] == 4
