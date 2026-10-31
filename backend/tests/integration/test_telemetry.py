"""Integration tests for telemetry ingestion and alert creation per Phase P4."""

from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import httpx
import pytest
import redis.asyncio as aioredis
from sqlalchemy import pool, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.deps import get_db, get_redis
from app.config import settings
from app.db.models import Event, Machine, TrendPoint
from app.db.repositories.devices import create_device
from app.db.repositories.machines import create_machine
from app.db.repositories.users import create_user
from app.ids import generate_id
from app.main import app
from app.security import generate_device_key, hash_device_key, hash_password


@pytest.fixture
async def setup_client_and_db() -> AsyncGenerator[
    tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis], None
]:
    """Test client with isolated DB and Redis."""
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


def _make_telemetry_payload(
    device_id: str, machine_id: str, seq: int = 1, z_score: float = 5.2
) -> dict[str, object]:
    """Helper to generate valid TelemetryIn dictionary."""
    return {
        "device_id": device_id,
        "machine_id": machine_id,
        "ts": datetime.now(UTC).isoformat(),
        "seq": seq,
        "fs": 1000,
        "n": 512,
        "rms_g": 0.85,
        "baseline": {"mean": 0.20, "std": 0.03},
        "z_score": z_score,
        "peaks": [{"freq_hz": 24.4, "amp_g": 0.52}],
        "rpm_est": 1465.0,
        "fw": "1.0.0",
    }


async def test_telemetry_accepted_and_event_creation(
    setup_client_and_db: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Verify happy path: telemetry accepted (202), event created, machine ALERT."""
    client, session_factory, _ = setup_client_and_db

    user_id = generate_id("usr_")
    mch_id = generate_id("mch_")
    dev_id = generate_id("dev_")
    raw_key = generate_device_key()

    async with session_factory() as session:
        await create_user(
            session, user_id, f"u_{user_id}@example.com", hash_password("pass"), "Owner", "owner"
        )
        machine = Machine(
            id=mch_id,
            owner_id=user_id,
            name="Lathe 1",
            machine_type="lathe",
            supervisor_phone="+919800000000",
            status="LEARNING",
        )
        await create_machine(session, machine)
        await create_device(session, dev_id, mch_id, hash_device_key(raw_key))
        await session.commit()

    payload = _make_telemetry_payload(dev_id, mch_id, seq=100)
    headers = {"X-Device-Key": raw_key}

    res = await client.post("/v1/telemetry", json=payload, headers=headers)
    assert res.status_code == 202
    data = res.json()
    assert data["status"] == "accepted"
    event_id = data["event_id"]
    assert event_id.startswith("evt_")

    # Check DB event and machine status
    async with session_factory() as session:
        evt = await session.get(Event, event_id)
        assert evt is not None
        assert evt.status.value == "ANOMALY_DETECTED"
        assert evt.seq == 100

        mch = await session.get(Machine, mch_id)
        assert mch is not None
        assert mch.status == "ALERT"


async def test_telemetry_forbidden_on_machine_mismatch(
    setup_client_and_db: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Verify 403 Forbidden when device tries to report for a different machine."""
    client, session_factory, _ = setup_client_and_db

    user_id = generate_id("usr_")
    mch_id1 = generate_id("mch_")
    mch_id2 = generate_id("mch_")
    dev_id = generate_id("dev_")
    raw_key = generate_device_key()

    async with session_factory() as session:
        await create_user(
            session, user_id, f"u_{user_id}@example.com", hash_password("pass"), "Owner", "owner"
        )
        m1 = Machine(
            id=mch_id1,
            owner_id=user_id,
            name="M1",
            machine_type="lathe",
            supervisor_phone="+919800000000",
        )
        m2 = Machine(
            id=mch_id2,
            owner_id=user_id,
            name="M2",
            machine_type="lathe",
            supervisor_phone="+919800000000",
        )
        await create_machine(session, m1)
        await create_machine(session, m2)
        await create_device(session, dev_id, mch_id1, hash_device_key(raw_key))
        await session.commit()

    # Payload references mch_id2, but device is bound to mch_id1
    payload = _make_telemetry_payload(dev_id, mch_id2, seq=1)
    res = await client.post("/v1/telemetry", json=payload, headers={"X-Device-Key": raw_key})
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"


async def test_telemetry_idempotency_duplicate_seq(
    setup_client_and_db: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Verify duplicate seq returns accepted with original event_id and creates no new event."""
    client, session_factory, _ = setup_client_and_db

    user_id = generate_id("usr_")
    mch_id = generate_id("mch_")
    dev_id = generate_id("dev_")
    raw_key = generate_device_key()

    async with session_factory() as session:
        await create_user(
            session, user_id, f"u_{user_id}@example.com", hash_password("pass"), "Owner", "owner"
        )
        m = Machine(
            id=mch_id,
            owner_id=user_id,
            name="M",
            machine_type="lathe",
            supervisor_phone="+919800000000",
        )
        await create_machine(session, m)
        await create_device(session, dev_id, mch_id, hash_device_key(raw_key))
        await session.commit()

    payload = _make_telemetry_payload(dev_id, mch_id, seq=42)
    headers = {"X-Device-Key": raw_key}

    # First attempt -> accepted
    res1 = await client.post("/v1/telemetry", json=payload, headers=headers)
    assert res1.status_code == 202
    event_id1 = res1.json()["event_id"]

    # Duplicate attempt with same seq -> 202 accepted with same event_id
    res2 = await client.post("/v1/telemetry", json=payload, headers=headers)
    assert res2.status_code == 202
    data2 = res2.json()
    assert data2["status"] == "accepted"
    assert data2["event_id"] == event_id1

    # Verify only 1 event exists in database for this device
    async with session_factory() as session:
        events = (
            (await session.execute(select(Event).where(Event.device_id == dev_id))).scalars().all()
        )
        assert len(events) == 1


async def test_telemetry_cooldown_suppression(
    setup_client_and_db: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Verify second telemetry within cooldown returns 202 suppressed and creates no event."""
    client, session_factory, _ = setup_client_and_db

    user_id = generate_id("usr_")
    mch_id = generate_id("mch_")
    dev_id = generate_id("dev_")
    raw_key = generate_device_key()

    async with session_factory() as session:
        await create_user(
            session, user_id, f"u_{user_id}@example.com", hash_password("pass"), "Owner", "owner"
        )
        m = Machine(
            id=mch_id,
            owner_id=user_id,
            name="M",
            machine_type="lathe",
            supervisor_phone="+919800000000",
        )
        await create_machine(session, m)
        await create_device(session, dev_id, mch_id, hash_device_key(raw_key))
        await session.commit()

    headers = {"X-Device-Key": raw_key}

    # 1. First alert -> accepted
    res1 = await client.post(
        "/v1/telemetry", json=_make_telemetry_payload(dev_id, mch_id, seq=1), headers=headers
    )
    assert res1.status_code == 202
    assert res1.json()["status"] == "accepted"

    # 2. Second alert with different seq during cooldown -> suppressed, event_id: null
    res2 = await client.post(
        "/v1/telemetry", json=_make_telemetry_payload(dev_id, mch_id, seq=2), headers=headers
    )
    assert res2.status_code == 202
    assert res2.json()["status"] == "suppressed"
    assert res2.json()["event_id"] is None

    # Trend point should still be written
    async with session_factory() as session:
        trends = (
            (await session.execute(select(TrendPoint).where(TrendPoint.machine_id == mch_id)))
            .scalars()
            .all()
        )
        assert len(trends) >= 2


async def test_telemetry_daily_cap_and_rate_limit(
    setup_client_and_db: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Verify 6th alert of the day returns suppressed and yields exactly 5 events."""
    client, session_factory, redis_client = setup_client_and_db

    user_id = generate_id("usr_")
    mch_id = generate_id("mch_")
    dev_id = generate_id("dev_")
    raw_key = generate_device_key()

    async with session_factory() as session:
        await create_user(
            session, user_id, f"u_{user_id}@example.com", hash_password("pass"), "Owner", "owner"
        )
        m = Machine(
            id=mch_id,
            owner_id=user_id,
            name="M",
            machine_type="lathe",
            supervisor_phone="+919800000000",
        )
        await create_machine(session, m)
        await create_device(session, dev_id, mch_id, hash_device_key(raw_key))
        await session.commit()

    headers = {"X-Device-Key": raw_key}

    # Clear rate limit and cooldown between calls to test daily cap independently
    for i in range(1, 6):
        await redis_client.delete(f"cooldown:machine:{mch_id}")
        minute_str = datetime.now(UTC).strftime("%Y%m%d%H%M")
        await redis_client.delete(f"ratelimit:device:{dev_id}:{minute_str}")

        res = await client.post(
            "/v1/telemetry", json=_make_telemetry_payload(dev_id, mch_id, seq=i), headers=headers
        )
        assert res.status_code == 202
        assert res.json()["status"] == "accepted"

    # 6th alert of the day -> daily cap exceeded (> 5) -> suppressed!
    await redis_client.delete(f"cooldown:machine:{mch_id}")
    minute_str = datetime.now(UTC).strftime("%Y%m%d%H%M")
    await redis_client.delete(f"ratelimit:device:{dev_id}:{minute_str}")

    res6 = await client.post(
        "/v1/telemetry", json=_make_telemetry_payload(dev_id, mch_id, seq=6), headers=headers
    )
    assert res6.status_code == 202
    assert res6.json()["status"] == "suppressed"
    assert res6.json()["event_id"] is None

    # Total events in DB for this machine should be exactly 5
    async with session_factory() as session:
        events = (
            (await session.execute(select(Event).where(Event.machine_id == mch_id))).scalars().all()
        )
        assert len(events) == 5
