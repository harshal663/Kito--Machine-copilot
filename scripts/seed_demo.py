#!/usr/bin/env python3
"""Seed Demo Data Script.

Creates demo user, machine, bound device, and manual fixture. Idempotent.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

# Add backend directory to sys.path so app imports resolve
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from sqlalchemy import select
from app.config import settings
from app.db.models import Device, Machine, Manual, ManualChunk, User
from app.db.session import async_session_factory
from app.ids import generate_id
from app.security import generate_device_key, hash_device_key, hash_password
from app.services.embeddings import embed_text


async def seed() -> None:
    """Run idempotent seeding."""
    print("[SEED] Starting Machine Copilot demo seed...")

    email = os.getenv("DEMO_USER_EMAIL", "owner@example.com")
    password = os.getenv("DEMO_USER_PASSWORD", "Password123!")
    full_name = "Primary Plant Supervisor"

    async with async_session_factory() as session:
        # 1. User
        res = await session.execute(select(User).where(User.email == email))
        user = res.scalar_one_or_none()
        if not user:
            user = User(
                id=generate_id("usr_"),
                email=email,
                password_hash=hash_password(password),
                full_name=full_name,
                role="owner",
            )
            session.add(user)
            await session.commit()
            print(f"[+] Created user: {user.email} (ID: {user.id})")
        else:
            print(f"[-] User already exists: {user.email} (ID: {user.id})")

        # 2. Machine
        machine_name = os.getenv("DEMO_MACHINE_NAME", "Centrifugal Slurry Pump #3")
        res_m = await session.execute(
            select(Machine).where(Machine.owner_id == user.id, Machine.name == machine_name)
        )
        machine = res_m.scalar_one_or_none()
        if not machine:
            machine = Machine(
                id=generate_id("mch_"),
                owner_id=user.id,
                name=machine_name,
                machine_type="Centrifugal Pump",
                model="Warman 10/8 AH",
                rated_rpm=1465.0,
                supervisor_name="Ramesh Kumar",
                supervisor_phone=os.getenv("DEMO_PHONE", "+919876543210"),
                backup_phone=os.getenv("DEMO_BACKUP_PHONE", "+919123456789"),
                language="en",
                status="HEALTHY",
            )
            session.add(machine)
            await session.commit()
            print(f"[+] Created machine: {machine.name} (ID: {machine.id})")
        else:
            print(f"[-] Machine already exists: {machine.name} (ID: {machine.id})")

        # 3. Device
        res_d = await session.execute(select(Device).where(Device.machine_id == machine.id))
        device = res_d.scalar_one_or_none()
        device_key = None
        if not device:
            raw_key = generate_device_key()
            device = Device(
                id=generate_id("dev_"),
                machine_id=machine.id,
                key_hash=hash_device_key(raw_key),
                firmware_version="1.0.0",
            )
            session.add(device)
            await session.commit()
            device_key = raw_key
            print(f"+ Created and bound sensor node: {device.id}")
            print(f"[DEVICE_KEY] Store in ESP32 firmware secrets.h: {raw_key}")
        else:
            print(f"- Sensor node already bound: {device.id}")

        # 4. Manual & Knowledge Chunks
        res_man = await session.execute(select(Manual).where(Manual.machine_id == machine.id))
        manual = res_man.scalar_one_or_none()
        if not manual:
            manual = Manual(
                id=generate_id("man_"),
                machine_id=machine.id,
                filename="slurry_pump_maintenance_guide.pdf",
                status="READY",
                embedding_model=settings.EMBEDDING_BACKEND,
            )
            session.add(manual)

            # Add sample maintenance chunks
            chunks_data = [
                (
                    1,
                    0,
                    "Centrifugal slurry pump vibration analysis: A prominent vibration peak at 1x rotational speed (typically 24.4 Hz at 1465 RPM) indicates severe impeller mass unbalance due to slurry cake buildup or abrasive vane erosion. Action: Clean impeller and rebalance rotor.",
                ),
                (
                    2,
                    1,
                    "Angular and parallel misalignment in slurry pump drive shafts manifests as elevated 2x running speed vibration peaks (48.8 Hz at 1465 RPM). Action: Check flexible coupling condition, laser-align drive shaft and driven unit.",
                ),
                (
                    3,
                    2,
                    "Mechanical looseness and foundation deterioration create multiple integer harmonics of running speed (3x, 4x, 5x peaks). Action: Torque foundation hold-down bolts to specified 180 Nm and inspect baseplate grouting.",
                ),
            ]

            for page, idx, content in chunks_data:
                emb = embed_text(content)
                chunk_row = ManualChunk(
                    manual_id=manual.id,
                    machine_id=machine.id,
                    page=page,
                    chunk_index=idx,
                    content=content,
                    embedding=emb,
                )
                session.add(chunk_row)

            await session.commit()
            print(f"+ Seeded manual and RAG chunks: {manual.filename} (ID: {manual.id})")
        else:
            print(f"- Manual already exists: {manual.filename}")

    print("\n[SUCCESS] Demo environment seeding complete!")


if __name__ == "__main__":
    asyncio.run(seed())
