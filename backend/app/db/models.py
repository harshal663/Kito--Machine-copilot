"""SQLAlchemy 2.0 ORM models mirroring ARCHITECTURE.md §6.2."""

from datetime import datetime
from enum import StrEnum
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base declarative class."""

    pass


class EventStatus(StrEnum):
    """Event status state machine states per ARCHITECTURE.md §5.1."""

    ANOMALY_DETECTED = "ANOMALY_DETECTED"
    DIAGNOSING = "DIAGNOSING"
    CALLING = "CALLING"
    NO_ANSWER = "NO_ANSWER"
    RETRYING = "RETRYING"
    ESCALATED = "ESCALATED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    INSPECTION_SCHEDULED = "INSPECTION_SCHEDULED"
    SHUTDOWN_REQUESTED = "SHUTDOWN_REQUESTED"
    FAILED = "FAILED"


event_status_enum = ENUM(
    EventStatus,
    name="event_status",
    create_type=False,
    values_callable=lambda obj: [e.value for e in obj],
)


class User(Base):
    """System user: owner, supervisor, admin."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # usr_...
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(
        Text,
        CheckConstraint("role IN ('owner', 'supervisor', 'admin')"),
        nullable=False,
    )
    phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(Text, nullable=False, default="en")
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    onboarding_step: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    machines: Mapped[list["Machine"]] = relationship("Machine", back_populates="owner")
    factory: Mapped["Factory | None"] = relationship(
        "Factory", back_populates="owner", uselist=False
    )


class Factory(Base):
    """Owner's manufacturing unit / factory aggregate (Added in run 2)."""

    __tablename__ = "factories"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # fac_...
    owner_id: Mapped[str] = mapped_column(Text, ForeignKey("users.id"), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    industry: Mapped[str] = mapped_column(Text, nullable=False)
    address_line: Mapped[str] = mapped_column(Text, nullable=False)
    city: Mapped[str] = mapped_column(Text, nullable=False)
    state: Mapped[str] = mapped_column(Text, nullable=False)
    pincode: Mapped[str] = mapped_column(Text, nullable=False)
    employee_band: Mapped[str] = mapped_column(Text, nullable=False)
    gstin: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    owner: Mapped["User"] = relationship("User", back_populates="factory")
    machines: Mapped[list["Machine"]] = relationship("Machine", back_populates="factory")


class Machine(Base):
    """Monitored machine entity."""

    __tablename__ = "machines"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # mch_...
    owner_id: Mapped[str] = mapped_column(Text, ForeignKey("users.id"), nullable=False)
    factory_id: Mapped[str | None] = mapped_column(Text, ForeignKey("factories.id"), nullable=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    machine_type: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str | None] = mapped_column(Text, nullable=True)
    rated_rpm: Mapped[float | None] = mapped_column(Float, nullable=True)
    supervisor_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    supervisor_phone: Mapped[str] = mapped_column(Text, nullable=False)
    backup_phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(Text, nullable=False, default="en")
    status: Mapped[str] = mapped_column(
        Text,
        CheckConstraint("status IN ('LEARNING', 'HEALTHY', 'ALERT', 'OFFLINE')"),
        nullable=False,
        default="LEARNING",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    owner: Mapped["User"] = relationship("User", back_populates="machines")
    factory: Mapped["Factory | None"] = relationship("Factory", back_populates="machines")
    device: Mapped["Device | None"] = relationship(
        "Device", back_populates="machine", uselist=False
    )
    manuals: Mapped[list["Manual"]] = relationship("Manual", back_populates="machine")
    events: Mapped[list["Event"]] = relationship("Event", back_populates="machine")
    trend_points: Mapped[list["TrendPoint"]] = relationship("TrendPoint", back_populates="machine")


class Device(Base):
    """ESP32 sensor node binding."""

    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # dev_...
    machine_id: Mapped[str | None] = mapped_column(
        Text,
        ForeignKey("machines.id", ondelete="SET NULL"),
        unique=True,
        nullable=True,
    )
    key_hash: Mapped[str] = mapped_column(Text, nullable=False)
    firmware_version: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    machine: Mapped["Machine | None"] = relationship("Machine", back_populates="device")


class Manual(Base):
    """Machine documentation manual."""

    __tablename__ = "manuals"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # man_...
    machine_id: Mapped[str | None] = mapped_column(
        Text,
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=True,
    )
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(
        Text,
        CheckConstraint("status IN ('PROCESSING', 'READY', 'FAILED')"),
        nullable=False,
    )
    embedding_model: Mapped[str] = mapped_column(Text, nullable=False)
    error_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    machine: Mapped["Machine | None"] = relationship("Machine", back_populates="manuals")
    chunks: Mapped[list["ManualChunk"]] = relationship("ManualChunk", back_populates="manual")


class ManualChunk(Base):
    """Embedded manual passages for RAG retrieval."""

    __tablename__ = "manual_chunks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    manual_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("manuals.id", ondelete="CASCADE"),
        nullable=False,
    )
    machine_id: Mapped[str | None] = mapped_column(
        Text,
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=True,
    )
    page: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(384), nullable=False)

    __table_args__ = (
        UniqueConstraint("manual_id", "chunk_index", name="uq_manual_chunks_manual_chunk_index"),
        Index("manual_chunks_machine_idx", "machine_id"),
    )

    manual: Mapped["Manual"] = relationship("Manual", back_populates="chunks")


class Event(Base):
    """Vibration anomaly alert event."""

    __tablename__ = "events"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # evt_...
    machine_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
    )
    device_id: Mapped[str | None] = mapped_column(
        Text,
        ForeignKey("devices.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[EventStatus] = mapped_column(
        event_status_enum,
        nullable=False,
    )
    severity: Mapped[str | None] = mapped_column(
        Text,
        CheckConstraint("severity IN ('LOW', 'MEDIUM', 'HIGH')"),
        nullable=True,
    )
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    seq: Mapped[int] = mapped_column(BigInteger, nullable=False)
    rms_g: Mapped[float] = mapped_column(Float, nullable=False)
    z_score: Mapped[float] = mapped_column(Float, nullable=False)
    baseline_mean: Mapped[float] = mapped_column(Float, nullable=False)
    baseline_std: Mapped[float] = mapped_column(Float, nullable=False)
    peaks: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    hints: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    rpm_est: Mapped[float | None] = mapped_column(Float, nullable=True)
    diagnosis: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    diagnosis_source: Mapped[str | None] = mapped_column(
        Text,
        CheckConstraint("diagnosis_source IN ('llm', 'fallback')"),
        nullable=True,
    )
    decision: Mapped[str | None] = mapped_column(
        Text,
        CheckConstraint(
            "decision IN ('ACKNOWLEDGED', 'INSPECTION_SCHEDULED', 'SHUTDOWN_REQUESTED')"
        ),
        nullable=True,
    )
    decided_by: Mapped[str | None] = mapped_column(Text, ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("device_id", "seq", name="uq_events_device_id_seq"),
        Index("events_machine_created_idx", "machine_id", created_at.desc()),
    )

    machine: Mapped["Machine"] = relationship("Machine", back_populates="events")
    call_attempts: Mapped[list["CallAttempt"]] = relationship(
        "CallAttempt", back_populates="event", order_by="CallAttempt.attempt_no"
    )


class CallAttempt(Base):
    """Outbound phone call attempt record."""

    __tablename__ = "call_attempts"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # cal_...
    event_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
    )
    attempt_no: Mapped[int] = mapped_column(
        Integer,
        CheckConstraint("attempt_no >= 1"),
        nullable=False,
    )
    to_phone: Mapped[str] = mapped_column(Text, nullable=False)
    provider_call_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    state: Mapped[str] = mapped_column(
        Text,
        CheckConstraint(
            "state IN ('QUEUED', 'RINGING', 'ANSWERED', 'COMPLETED', 'NO_ANSWER', 'FAILED')"
        ),
        nullable=False,
    )
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_decision: Mapped[str | None] = mapped_column(
        Text,
        CheckConstraint(
            "extracted_decision IN ('ACKNOWLEDGED', 'INSPECTION_SCHEDULED', 'SHUTDOWN_REQUESTED')"
        ),
        nullable=True,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("event_id", "attempt_no", name="uq_call_attempts_event_id_attempt_no"),
    )

    event: Mapped["Event"] = relationship("Event", back_populates="call_attempts")


class TrendPoint(Base):
    """Time-series vibration data point."""

    __tablename__ = "trend_points"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    machine_id: Mapped[str] = mapped_column(
        Text,
        ForeignKey("machines.id", ondelete="CASCADE"),
        nullable=False,
    )
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    rms_g: Mapped[float] = mapped_column(Float, nullable=False)
    band_energy: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    source: Mapped[str] = mapped_column(
        Text,
        CheckConstraint("source IN ('alert_window', 'hourly_rollup')"),
        nullable=False,
    )

    __table_args__ = (Index("trend_points_machine_ts_idx", "machine_id", ts.desc()),)

    machine: Mapped["Machine"] = relationship("Machine", back_populates="trend_points")


class AuditLog(Base):
    """Immutable audit trail for all state changes and decisions."""

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    actor: Mapped[str] = mapped_column(Text, nullable=False)  # usr_..., dev_..., or "system"
    action: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (Index("audit_log_entity_idx", "entity_type", "entity_id"),)
