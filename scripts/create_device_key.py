#!/usr/bin/env python3
"""Create Device Key Script.

Binds a new sensor node to a specified machine ID and prints the raw key once.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from sqlalchemy import select
from app.db.models import Device, Machine
from app.db.session import async_session_factory
from app.ids import generate_id
from app.security import generate_device_key, hash_device_key


async def create_key(machine_id: str) -> None:
    async with async_session_factory() as session:
        res = await session.execute(select(Machine).where(Machine.id == machine_id))
        machine = res.scalar_one_or_none()
        if not machine:
            print(f"❌ Machine '{machine_id}' not found.")
            sys.exit(1)

        raw_key = generate_device_key()
        device = Device(
            id=generate_id("dev_"),
            machine_id=machine.id,
            key_hash=hash_device_key(raw_key),
            firmware_version="1.0.0",
        )
        session.add(device)
        await session.commit()

        print(f"✓ Sensor node created: {device.id}")
        print(f"✓ Bound to machine: {machine.name} ({machine.id})")
        print(f"🔑 RAW DEVICE KEY (X-Device-Key): {raw_key}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate and bind a new device key")
    parser.add_argument("machine_id", help="Machine ID (mch_...) to bind")
    args = parser.parse_args()
    asyncio.run(create_key(args.machine_id))


if __name__ == "__main__":
    main()
