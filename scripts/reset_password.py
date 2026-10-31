#!/usr/bin/env python3
"""Admin script to reset a user's password without email dependencies.

Usage:
    python scripts/reset_password.py --email owner@example.com [--password NewPassword123!]
"""

import argparse
import asyncio
import getpass
import sys
from pathlib import Path
from typing import Any

# Add backend directory to path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "backend"))

import redis.asyncio as aioredis
from sqlalchemy import func, select

from app.config import settings
from app.db.models import User
from app.db.session import async_session_factory
from app.security import hash_password


async def reset_password(
    email: str,
    new_password: str,
    session_factory: Any = None,
) -> bool:
    """Update password_hash in database and clear failed login rate limits in Redis."""
    if len(new_password) < 10:
        print("[ERROR] Password must be at least 10 characters long.")
        return False

    normalized_email = email.lower().strip()
    hashed = hash_password(new_password)
    maker = session_factory or async_session_factory

    # 1. Update database
    async with maker() as session:
        result = await session.execute(
            select(User).where(func.lower(User.email) == normalized_email)
        )
        user = result.scalar_one_or_none()
        if not user:
            print(f"[ERROR] User with email '{normalized_email}' not found.")
            return False

        user.password_hash = hashed
        await session.commit()

    # 2. Clear any active login lockout from Redis
    try:
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await redis_client.delete(f"ratelimit:login:failed:{normalized_email}")
        await redis_client.aclose()
    except Exception as exc:
        print(f"[WARN] Failed to clear Redis login lockout: {exc}")

    print(f"[SUCCESS] Password for '{normalized_email}' reset successfully.")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Admin password reset tool")
    parser.add_argument("--email", required=True, help="User email address")
    parser.add_argument("--password", help="New password (prompted if not provided)")
    args = parser.parse_args()

    password = args.password
    if not password:
        password = getpass.getpass("Enter new password (min 10 chars): ")
        confirm = getpass.getpass("Confirm new password: ")
        if password != confirm:
            print("[ERROR] Passwords do not match.")
            sys.exit(1)

    success = asyncio.run(reset_password(args.email, password))
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
