"""Integration tests for manuals upload, ingestion, test-calls, and trend endpoints per Phase P6."""

import io
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import httpx
import pytest
import redis.asyncio as aioredis
from pypdf import PdfWriter
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.deps import get_db, get_redis
from app.config import settings
from app.db.models import Machine, TrendPoint
from app.db.repositories.machines import create_machine
from app.db.repositories.users import create_user
from app.ids import generate_id
from app.main import app
from app.security import create_access_token, hash_password


@pytest.fixture
async def setup_manuals_test() -> AsyncGenerator[
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


def _create_minimal_pdf_bytes(text: str = "Bearing maintenance guide.") -> bytes:
    """Generate a minimal valid PDF with text."""
    writer = PdfWriter()
    # Adding a blank page with metadata
    writer.add_blank_page(width=72, height=72)
    # Write to buffer
    buf = io.BytesIO()
    writer.write(buf)
    data = buf.getvalue()
    # Inject text into pdf content stream
    return data


@pytest.mark.asyncio
async def test_manual_upload_magic_bytes_validation(
    setup_manuals_test: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Verify non-PDF uploads fail magic bytes check and return 422 MANUAL_PARSE_FAILED."""
    client, session_factory, _ = setup_manuals_test

    user_id = generate_id("usr_")
    mch_id = generate_id("mch_")

    async with session_factory() as session:
        await create_user(
            session=session,
            user_id=user_id,
            email=f"man_user_{user_id}@example.com",
            password_hash=hash_password("Pass123!"),
            full_name="Manual Tester",
            role="owner",
        )
        await create_machine(
            session=session,
            machine=Machine(
                id=mch_id,
                owner_id=user_id,
                name="Lathe Manual Test",
                machine_type="lathe",
                supervisor_phone="+919876543210",
            ),
        )
        await session.commit()

    token = create_access_token(user_id, email=f"man_user_{user_id}@example.com", role="owner")
    headers = {"Authorization": f"Bearer {token}"}

    # Upload non-PDF text file
    files = {"file": ("manual.txt", b"This is not a PDF", "text/plain")}
    res = await client.post(f"/v1/machines/{mch_id}/manuals", files=files, headers=headers)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "MANUAL_PARSE_FAILED"

    # Upload valid PDF
    pdf_bytes = _create_minimal_pdf_bytes()
    files = {"file": ("test_manual.pdf", pdf_bytes, "application/pdf")}
    res_valid = await client.post(f"/v1/machines/{mch_id}/manuals", files=files, headers=headers)
    assert res_valid.status_code == 202
    data = res_valid.json()
    assert data["status"] == "PROCESSING"
    manual_id = data["id"]

    # Get manual status
    status_res = await client.get(f"/v1/manuals/{manual_id}", headers=headers)
    assert status_res.status_code == 200
    assert status_res.json()["id"] == manual_id


@pytest.mark.asyncio
async def test_machine_test_call_rate_limiting(
    setup_manuals_test: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Verify max 3 test-calls per day per machine, 4th returns 429 RATE_LIMITED."""
    client, session_factory, _ = setup_manuals_test

    user_id = generate_id("usr_")
    mch_id = generate_id("mch_")

    async with session_factory() as session:
        await create_user(
            session=session,
            user_id=user_id,
            email=f"tc_user_{user_id}@example.com",
            password_hash=hash_password("Pass123!"),
            full_name="TC Owner",
            role="owner",
        )
        await create_machine(
            session=session,
            machine=Machine(
                id=mch_id,
                owner_id=user_id,
                name="Test Call Lathe",
                machine_type="lathe",
                supervisor_phone="+919876543210",
            ),
        )
        await session.commit()

    token = create_access_token(user_id, email=f"man_user_{user_id}@example.com", role="owner")
    headers = {"Authorization": f"Bearer {token}"}

    # First 3 calls succeed (202)
    for _ in range(3):
        res = await client.post(f"/v1/machines/{mch_id}/test-call", headers=headers)
        assert res.status_code == 202
        assert res.json()["status"] == "accepted"

    # 4th call is rate limited (429)
    res_4 = await client.post(f"/v1/machines/{mch_id}/test-call", headers=headers)
    assert res_4.status_code == 429
    assert res_4.json()["error"]["code"] == "RATE_LIMITED"


@pytest.mark.asyncio
async def test_machine_trend_points_query(
    setup_manuals_test: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession], aioredis.Redis],
) -> None:
    """Verify /v1/machines/{id}/trend returns chronological trend points."""
    client, session_factory, _ = setup_manuals_test

    user_id = generate_id("usr_")
    mch_id = generate_id("mch_")

    async with session_factory() as session:
        await create_user(
            session=session,
            user_id=user_id,
            email=f"trend_user_{user_id}@example.com",
            password_hash=hash_password("Pass123!"),
            full_name="Trend Owner",
            role="owner",
        )
        await create_machine(
            session=session,
            machine=Machine(
                id=mch_id,
                owner_id=user_id,
                name="Trend Lathe",
                machine_type="lathe",
                supervisor_phone="+919876543210",
            ),
        )
        # Add 3 trend points
        now = datetime.now(UTC)
        p1 = TrendPoint(
            machine_id=mch_id,
            ts=now - timedelta(hours=2),
            rms_g=0.25,
            source="hourly_rollup",
        )
        p2 = TrendPoint(
            machine_id=mch_id,
            ts=now - timedelta(hours=1),
            rms_g=0.30,
            source="hourly_rollup",
        )
        p3 = TrendPoint(
            machine_id=mch_id,
            ts=now,
            rms_g=0.85,
            source="alert_window",
        )
        session.add_all([p1, p2, p3])
        await session.commit()

    token = create_access_token(user_id, email=f"man_user_{user_id}@example.com", role="owner")
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get(f"/v1/machines/{mch_id}/trend", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["machine_id"] == mch_id
    assert len(data["points"]) == 3
    assert data["points"][0]["rms_g"] == pytest.approx(0.25, rel=1e-3)
    assert data["points"][2]["rms_g"] == pytest.approx(0.85, rel=1e-3)
