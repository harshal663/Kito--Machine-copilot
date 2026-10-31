"""0002_add_auth_onboarding_factory: Add factory table, onboarding state, and user profile fields.

Revision ID: 0002_auth_onboarding_factory
Revises: 0001_initial
Create Date: 2026-10-31 10:30:00.000000
"""

from alembic import op

revision = "0002_auth_onboarding_factory"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

UP_STATEMENTS = [
    # 1. Extend users table
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_step INT NOT NULL DEFAULT 1;",
    # 2. Create factories table
    """CREATE TABLE IF NOT EXISTS factories (
  id             TEXT PRIMARY KEY,
  owner_id       TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  industry       TEXT NOT NULL,
  address_line   TEXT NOT NULL,
  city           TEXT NOT NULL,
  state          TEXT NOT NULL,
  pincode        TEXT NOT NULL,
  employee_band  TEXT NOT NULL,
  gstin          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);""",
    "CREATE INDEX IF NOT EXISTS factories_owner_idx ON factories(owner_id);",
    # 3. Add factory reference to machines
    "ALTER TABLE machines ADD COLUMN IF NOT EXISTS factory_id TEXT REFERENCES factories(id) ON DELETE SET NULL;",
    "CREATE INDEX IF NOT EXISTS machines_factory_idx ON machines(factory_id);",
]

DOWN_STATEMENTS = [
    "DROP INDEX IF EXISTS machines_factory_idx;",
    "ALTER TABLE machines DROP COLUMN IF EXISTS factory_id;",
    "DROP INDEX IF EXISTS factories_owner_idx;",
    "DROP TABLE IF EXISTS factories CASCADE;",
    "ALTER TABLE users DROP COLUMN IF EXISTS onboarding_step;",
    "ALTER TABLE users DROP COLUMN IF EXISTS onboarding_completed;",
    "ALTER TABLE users DROP COLUMN IF EXISTS language;",
    "ALTER TABLE users DROP COLUMN IF EXISTS phone;",
]


def upgrade() -> None:
    for stmt in UP_STATEMENTS:
        op.execute(stmt)


def downgrade() -> None:
    for stmt in DOWN_STATEMENTS:
        op.execute(stmt)
