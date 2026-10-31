"""Integration tests for worker diagnosis pipeline, RAG, and fallbacks per Phase P5."""

from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import pytest
from sqlalchemy import pool, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.db.models import AuditLog, Event, EventStatus, Machine, Manual, ManualChunk
from app.db.repositories.machines import create_machine
from app.db.repositories.users import create_user
from app.ids import generate_id
from app.security import hash_password
from app.services.embeddings import embed_text
from app.services.rag import retrieve_relevant_chunks
from app.workers.jobs import diagnose_and_call


@pytest.fixture
async def setup_db() -> AsyncGenerator[async_sessionmaker[AsyncSession], None]:
    """Provide isolated sessionmaker bound to test database."""
    engine = create_async_engine(settings.DATABASE_URL_TEST, poolclass=pool.NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    yield session_factory
    await engine.dispose()


@pytest.mark.asyncio
async def test_rag_retrieval_machine_and_generic(
    setup_db: async_sessionmaker[AsyncSession],
) -> None:
    """Verify RAG returns machine and generic chunks, filtering out others."""
    session_factory = setup_db

    async with session_factory() as session:
        user_id = generate_id("usr_")
        await create_user(
            session=session,
            user_id=user_id,
            email=f"rag_test_{user_id}@example.com",
            password_hash=hash_password("Password123!"),
            full_name="RAG User",
            role="owner",
        )
        mch_a = generate_id("mch_")
        mch_b = generate_id("mch_")
        await create_machine(
            session=session,
            machine=Machine(
                id=mch_a,
                owner_id=user_id,
                name="Lathe A",
                machine_type="lathe",
                supervisor_phone="+919876543210",
            ),
        )
        await create_machine(
            session=session,
            machine=Machine(
                id=mch_b,
                owner_id=user_id,
                name="Lathe B",
                machine_type="lathe",
                supervisor_phone="+919876543211",
            ),
        )

        man_a = Manual(
            id=generate_id("man_"),
            machine_id=mch_a,
            filename="lathe_a_manual.pdf",
            page_count=20,
            status="READY",
            embedding_model="hash",
        )
        man_generic = Manual(
            id=generate_id("man_"),
            machine_id=None,
            filename="generic_vibration_guide.pdf",
            page_count=50,
            status="READY",
            embedding_model="hash",
        )
        man_b = Manual(
            id=generate_id("man_"),
            machine_id=mch_b,
            filename="lathe_b_manual.pdf",
            page_count=10,
            status="READY",
            embedding_model="hash",
        )
        session.add_all([man_a, man_generic, man_b])
        await session.flush()

        text_a = "Spindle bearing inspection and replacement procedures for lathe."
        text_gen = "Vibration harmonic analysis and mechanical looseness guide."
        text_b = "Hydraulic pressure regulator troubleshooting for milling machine."

        chunk_a = ManualChunk(
            manual_id=man_a.id,
            machine_id=mch_a,
            page=14,
            chunk_index=0,
            content=text_a,
            embedding=embed_text(text_a),
        )
        chunk_gen = ManualChunk(
            manual_id=man_generic.id,
            machine_id=None,
            page=5,
            chunk_index=0,
            content=text_gen,
            embedding=embed_text(text_gen),
        )
        chunk_b = ManualChunk(
            manual_id=man_b.id,
            machine_id=mch_b,
            page=2,
            chunk_index=0,
            content=text_b,
            embedding=embed_text(text_b),
        )
        session.add_all([chunk_a, chunk_gen, chunk_b])
        await session.commit()

        # Query for Machine A
        retrieved = await retrieve_relevant_chunks(
            session=session,
            query_text="spindle bearing vibration",
            machine_id=mch_a,
            limit=4,
        )

        retrieved_texts = [r.content for r in retrieved]
        assert text_a in retrieved_texts
        assert text_gen in retrieved_texts
        assert text_b not in retrieved_texts


@pytest.mark.asyncio
async def test_diagnose_and_call_success_flow(setup_db: async_sessionmaker[AsyncSession]) -> None:
    """Verify diagnose_and_call processes ANOMALY_DETECTED -> DIAGNOSING -> CALLING."""
    session_factory = setup_db

    async with session_factory() as session:
        user_id = generate_id("usr_")
        await create_user(
            session=session,
            user_id=user_id,
            email=f"diag_user_{user_id}@example.com",
            password_hash=hash_password("Password123!"),
            full_name="Diag User",
            role="owner",
        )
        mch_id = generate_id("mch_")
        await create_machine(
            session=session,
            machine=Machine(
                id=mch_id,
                owner_id=user_id,
                name="Lathe 1",
                machine_type="lathe",
                rated_rpm=1465.0,
                supervisor_phone="+919876543210",
            ),
        )

        event_id = generate_id("evt_")
        event = Event(
            id=event_id,
            machine_id=mch_id,
            status=EventStatus.ANOMALY_DETECTED,
            severity="HIGH",
            ts=datetime.now(UTC),
            seq=101,
            rms_g=0.92,
            z_score=15.4,
            baseline_mean=0.20,
            baseline_std=0.03,
            peaks=[{"freq_hz": 24.4, "amp_g": 0.58}],
            hints=["1x dominant: imbalance"],
        )
        session.add(event)
        await session.commit()

    # Run the worker job
    ctx = {"session_factory": session_factory, "job_try": 1}
    await diagnose_and_call(ctx, event_id)

    # Verify event state in database
    async with session_factory() as session:
        updated_event = await session.get(Event, event_id)
        assert updated_event is not None
        assert updated_event.status == EventStatus.CALLING
        assert updated_event.diagnosis is not None
        assert updated_event.diagnosis_source == "llm"
        assert len(updated_event.diagnosis["probable_causes"]) >= 1

        # Check audit log entries
        audit_stmt = (
            select(AuditLog).where(AuditLog.entity_id == event_id).order_by(AuditLog.id.asc())
        )
        audit_rows = (await session.execute(audit_stmt)).scalars().all()
        actions = [a.action for a in audit_rows]
        assert "event.transition.diagnosing" in actions
        assert "event.transition.calling" in actions


@pytest.mark.asyncio
async def test_diagnose_and_call_fallback_mode(setup_db: async_sessionmaker[AsyncSession]) -> None:
    """Verify diagnose_and_call falls back to rule-based diagnosis on invalid LLM output."""
    session_factory = setup_db

    async with session_factory() as session:
        user_id = generate_id("usr_")
        await create_user(
            session=session,
            user_id=user_id,
            email=f"fallback_user_{user_id}@example.com",
            password_hash=hash_password("Password123!"),
            full_name="Fallback User",
            role="owner",
        )
        mch_id = generate_id("mch_")
        await create_machine(
            session=session,
            machine=Machine(
                id=mch_id,
                owner_id=user_id,
                name="Lathe 2",
                machine_type="lathe",
                rated_rpm=1465.0,
                supervisor_phone="+919876543210",
            ),
        )

        event_id = generate_id("evt_")
        event = Event(
            id=event_id,
            machine_id=mch_id,
            status=EventStatus.ANOMALY_DETECTED,
            severity="HIGH",
            ts=datetime.now(UTC),
            seq=202,
            rms_g=0.88,
            z_score=12.0,
            baseline_mean=0.20,
            baseline_std=0.03,
            peaks=[{"freq_hz": 48.8, "amp_g": 0.45}],
            hints=["2x peak: misalignment"],
        )
        session.add(event)
        await session.commit()

    # Simulate invalid LLM responses
    prev_mode = settings.MOCK_LLM_MODE
    settings.MOCK_LLM_MODE = "invalid"
    try:
        ctx = {"session_factory": session_factory, "job_try": 1}
        await diagnose_and_call(ctx, event_id)
    finally:
        settings.MOCK_LLM_MODE = prev_mode

    # Verify event transitioned to CALLING with fallback diagnosis
    async with session_factory() as session:
        updated_event = await session.get(Event, event_id)
        assert updated_event is not None
        assert updated_event.status == EventStatus.CALLING
        assert updated_event.diagnosis_source == "fallback"
        assert updated_event.diagnosis is not None
        causes = updated_event.diagnosis["probable_causes"]
        assert any("misalignment" in c["cause"].lower() for c in causes)
