"""Integration tests for database migration, schema, pgvector, HNSW, and round-trip operations."""

from datetime import UTC, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.db.models import (
    AuditLog,
    CallAttempt,
    Device,
    Event,
    EventStatus,
    Machine,
    Manual,
    ManualChunk,
    TrendPoint,
    User,
)
from app.ids import generate_id
from app.security import generate_device_key, hash_device_key, hash_password


@pytest.fixture
async def test_session() -> AsyncSession:
    """Provide an async session connected to the test database."""
    engine = create_async_engine(settings.DATABASE_URL_TEST, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        yield session
    await engine.dispose()


async def test_pgvector_and_hnsw_index_present(test_session: AsyncSession) -> None:
    """Verify pgvector extension and HNSW index exist."""
    # Check extension
    res = await test_session.execute(
        text("SELECT extname FROM pg_extension WHERE extname = 'vector'")
    )
    assert res.scalar_one_or_none() == "vector"

    # Check HNSW index on manual_chunks
    idx_res = await test_session.execute(
        text(
            "SELECT indexname, indexdef FROM pg_indexes "
            "WHERE tablename = 'manual_chunks' AND indexname = 'manual_chunks_embedding_idx'"
        )
    )
    row = idx_res.fetchone()
    assert row is not None
    assert "hnsw" in row[1].lower()


async def test_round_trip_all_tables(test_session: AsyncSession) -> None:
    """Test round-trip insert and select on every table in the schema."""
    now = datetime.now(UTC)

    # 1. User
    user_id = generate_id("usr_")
    user = User(
        id=user_id,
        email=f"test_{user_id}@example.com",
        password_hash=hash_password("Secret123!"),
        full_name="Test Owner",
        role="owner",
    )
    test_session.add(user)
    await test_session.flush()

    fetched_user = await test_session.get(User, user_id)
    assert fetched_user is not None
    assert fetched_user.email == user.email

    # 2. Machine
    mch_id = generate_id("mch_")
    machine = Machine(
        id=mch_id,
        owner_id=user_id,
        name="Lathe 1",
        machine_type="lathe",
        model="Ace 100",
        rated_rpm=1500.0,
        supervisor_name="Ramesh",
        supervisor_phone="+919800000000",
        language="en",
        status="LEARNING",
    )
    test_session.add(machine)
    await test_session.flush()

    fetched_mch = await test_session.get(Machine, mch_id)
    assert fetched_mch is not None
    assert fetched_mch.name == "Lathe 1"

    # 3. Device
    dev_id = generate_id("dev_")
    raw_key = generate_device_key()
    device = Device(
        id=dev_id,
        machine_id=mch_id,
        key_hash=hash_device_key(raw_key),
        firmware_version="1.0.0",
        last_seen_at=now,
    )
    test_session.add(device)
    await test_session.flush()

    fetched_dev = await test_session.get(Device, dev_id)
    assert fetched_dev is not None
    assert fetched_dev.machine_id == mch_id

    # 4. Manual & ManualChunk
    man_id = generate_id("man_")
    manual = Manual(
        id=man_id,
        machine_id=mch_id,
        filename="lathe_manual.pdf",
        page_count=20,
        status="READY",
        embedding_model="hash",
    )
    test_session.add(manual)
    await test_session.flush()

    fake_vector = [0.05] * 384
    chunk = ManualChunk(
        manual_id=man_id,
        machine_id=mch_id,
        page=1,
        chunk_index=0,
        content="Bearing lubrication instructions for Lathe 1.",
        embedding=fake_vector,
    )
    test_session.add(chunk)
    await test_session.flush()

    fetched_chunk = await test_session.get(ManualChunk, chunk.id)
    assert fetched_chunk is not None
    assert len(fetched_chunk.embedding) == 384

    # 5. Event
    evt_id = generate_id("evt_")
    event = Event(
        id=evt_id,
        machine_id=mch_id,
        device_id=dev_id,
        status=EventStatus.ANOMALY_DETECTED,
        severity="HIGH",
        ts=now,
        seq=1,
        rms_g=0.85,
        z_score=5.2,
        baseline_mean=0.2,
        baseline_std=0.03,
        peaks=[{"freq_hz": 24.4, "amp_g": 0.5}],
        hints=["1x dominant: imbalance"],
    )
    test_session.add(event)
    await test_session.flush()

    fetched_evt = await test_session.get(Event, evt_id)
    assert fetched_evt is not None
    assert fetched_evt.status == EventStatus.ANOMALY_DETECTED

    # 6. CallAttempt
    cal_id = generate_id("cal_")
    attempt = CallAttempt(
        id=cal_id,
        event_id=evt_id,
        attempt_no=1,
        to_phone="+919800000000",
        state="QUEUED",
    )
    test_session.add(attempt)
    await test_session.flush()

    fetched_cal = await test_session.get(CallAttempt, cal_id)
    assert fetched_cal is not None
    assert fetched_cal.state == "QUEUED"

    # 7. TrendPoint
    trend = TrendPoint(
        machine_id=mch_id,
        ts=now,
        rms_g=0.85,
        band_energy={"0-50": 0.4},
        source="alert_window",
    )
    test_session.add(trend)
    await test_session.flush()

    fetched_trend = await test_session.get(TrendPoint, trend.id)
    assert fetched_trend is not None
    assert fetched_trend.rms_g == pytest.approx(0.85, rel=1e-2)

    # 8. AuditLog
    log = AuditLog(
        actor="system",
        action="event.created",
        entity_type="event",
        entity_id=evt_id,
        data={"status": "ANOMALY_DETECTED"},
    )
    test_session.add(log)
    await test_session.flush()

    fetched_log = await test_session.get(AuditLog, log.id)
    assert fetched_log is not None
    assert fetched_log.action == "event.created"

    await test_session.rollback()
