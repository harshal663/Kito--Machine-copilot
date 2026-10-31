"""0001_initial: Execute ARCHITECTURE.md §6.2 DDL verbatim.

Revision ID: 0001_initial
Revises: None
Create Date: 2026-10-29 12:00:00.000000
"""

from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

UP_STATEMENTS = [
    "CREATE EXTENSION IF NOT EXISTS vector;",
    """DO $$ BEGIN
  CREATE TYPE event_status AS ENUM (
    'ANOMALY_DETECTED', 'DIAGNOSING', 'CALLING', 'NO_ANSWER', 'RETRYING',
    'ESCALATED', 'ACKNOWLEDGED', 'INSPECTION_SCHEDULED', 'SHUTDOWN_REQUESTED', 'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;""",
    """CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  full_name      TEXT,
  role           TEXT NOT NULL CHECK (role IN ('owner', 'supervisor', 'admin')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);""",
    """CREATE TABLE IF NOT EXISTS machines (
  id              TEXT PRIMARY KEY,
  owner_id        TEXT NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  machine_type    TEXT NOT NULL,
  model           TEXT,
  rated_rpm       REAL,
  supervisor_name TEXT,
  supervisor_phone TEXT NOT NULL,
  backup_phone    TEXT,
  language        TEXT NOT NULL DEFAULT 'en',
  status          TEXT NOT NULL DEFAULT 'LEARNING'
                  CHECK (status IN ('LEARNING', 'HEALTHY', 'ALERT', 'OFFLINE')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);""",
    "CREATE INDEX IF NOT EXISTS machines_owner_idx ON machines(owner_id);",
    """CREATE TABLE IF NOT EXISTS devices (
  id               TEXT PRIMARY KEY,
  machine_id       TEXT UNIQUE REFERENCES machines(id) ON DELETE SET NULL,
  key_hash         TEXT NOT NULL,
  firmware_version TEXT,
  last_seen_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);""",
    """CREATE TABLE IF NOT EXISTS manuals (
  id              TEXT PRIMARY KEY,
  machine_id      TEXT REFERENCES machines(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  page_count      INT,
  status          TEXT NOT NULL CHECK (status IN ('PROCESSING', 'READY', 'FAILED')),
  embedding_model TEXT NOT NULL,
  error_code      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);""",
    """CREATE TABLE IF NOT EXISTS manual_chunks (
  id          BIGSERIAL PRIMARY KEY,
  manual_id   TEXT NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
  machine_id  TEXT REFERENCES machines(id) ON DELETE CASCADE,
  page        INT NOT NULL,
  chunk_index INT NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(384) NOT NULL,
  UNIQUE (manual_id, chunk_index)
);""",
    "CREATE INDEX IF NOT EXISTS manual_chunks_machine_idx ON manual_chunks(machine_id);",
    """CREATE INDEX IF NOT EXISTS manual_chunks_embedding_idx ON manual_chunks
  USING hnsw (embedding vector_cosine_ops);""",
    """CREATE TABLE IF NOT EXISTS events (
  id              TEXT PRIMARY KEY,
  machine_id      TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  device_id       TEXT REFERENCES devices(id) ON DELETE SET NULL,
  status          event_status NOT NULL,
  severity        TEXT CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  ts              TIMESTAMPTZ NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  seq             BIGINT NOT NULL,
  rms_g           REAL NOT NULL,
  z_score         REAL NOT NULL,
  baseline_mean   REAL NOT NULL,
  baseline_std    REAL NOT NULL,
  peaks           JSONB NOT NULL DEFAULT '[]'::jsonb,
  hints           JSONB NOT NULL DEFAULT '[]'::jsonb,
  rpm_est         REAL,
  diagnosis       JSONB,
  diagnosis_source TEXT CHECK (diagnosis_source IN ('llm', 'fallback')),
  decision        TEXT CHECK (decision IN ('ACKNOWLEDGED', 'INSPECTION_SCHEDULED', 'SHUTDOWN_REQUESTED')),
  decided_by      TEXT REFERENCES users(id),
  decided_at      TIMESTAMPTZ,
  error_code      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, seq)
);""",
    "CREATE INDEX IF NOT EXISTS events_machine_created_idx ON events(machine_id, created_at DESC);",
    """CREATE INDEX IF NOT EXISTS events_status_idx ON events(status) WHERE status NOT IN ('ACKNOWLEDGED', 'INSPECTION_SCHEDULED', 'SHUTDOWN_REQUESTED');""",
    """CREATE TABLE IF NOT EXISTS call_attempts (
  id                 TEXT PRIMARY KEY,
  event_id           TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  attempt_no         INT NOT NULL CHECK (attempt_no >= 1),
  to_phone           TEXT NOT NULL,
  provider_call_id   TEXT,
  state              TEXT NOT NULL CHECK (state IN ('QUEUED', 'RINGING', 'ANSWERED', 'COMPLETED', 'NO_ANSWER', 'FAILED')),
  transcript         TEXT,
  extracted_decision TEXT CHECK (extracted_decision IN ('ACKNOWLEDGED', 'INSPECTION_SCHEDULED', 'SHUTDOWN_REQUESTED')),
  started_at         TIMESTAMPTZ,
  ended_at           TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, attempt_no)
);""",
    """CREATE TABLE IF NOT EXISTS trend_points (
  id          BIGSERIAL PRIMARY KEY,
  machine_id  TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  ts          TIMESTAMPTZ NOT NULL,
  rms_g       REAL NOT NULL,
  band_energy JSONB,
  source      TEXT NOT NULL CHECK (source IN ('alert_window', 'hourly_rollup'))
);""",
    "CREATE INDEX IF NOT EXISTS trend_points_machine_ts_idx ON trend_points(machine_id, ts DESC);",
    """CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  data        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);""",
    "CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log(entity_type, entity_id);",
]

DOWN_STATEMENTS = [
    "DROP TABLE IF EXISTS audit_log CASCADE;",
    "DROP TABLE IF EXISTS trend_points CASCADE;",
    "DROP TABLE IF EXISTS call_attempts CASCADE;",
    "DROP TABLE IF EXISTS events CASCADE;",
    "DROP TABLE IF EXISTS manual_chunks CASCADE;",
    "DROP TABLE IF EXISTS manuals CASCADE;",
    "DROP TABLE IF EXISTS devices CASCADE;",
    "DROP TABLE IF EXISTS machines CASCADE;",
    "DROP TABLE IF EXISTS users CASCADE;",
    "DROP TYPE IF EXISTS event_status CASCADE;",
]


def upgrade() -> None:
    for stmt in UP_STATEMENTS:
        op.execute(stmt)


def downgrade() -> None:
    for stmt in DOWN_STATEMENTS:
        op.execute(stmt)
