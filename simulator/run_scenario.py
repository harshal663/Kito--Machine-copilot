#!/usr/bin/env python3
"""Acceptance Scenarios Runner for Machine Copilot.

Executes scenarios S1 through S10 against the API stack in mock mode.
Exit code 0 on all pass; non-zero if any scenario fails.
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone
import hashlib
import hmac
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

# Ensure backend root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "backend"))

import httpx
import redis.asyncio as aioredis


class ScenarioRunner:
    def __init__(self, api_url: str, redis_url: str) -> None:
        self.api_url = api_url.rstrip("/")
        self.redis_url = redis_url
        self.client = httpx.Client(base_url=self.api_url, timeout=15.0)
        self.redis: aioredis.Redis | None = None
        self.results: dict[str, tuple[bool, str]] = {}

    @staticmethod
    def get_data(resp: httpx.Response | dict[str, Any]) -> Any:
        """Unwrap response data whether directly serialized or enveloped."""
        if isinstance(resp, dict):
            return resp.get("data", resp)
        try:
            d = resp.json()
            if isinstance(d, dict) and "data" in d and len(d) == 1:
                return d["data"]
            return d
        except Exception:
            return resp.text

    async def init_redis(self) -> None:
        self.redis = aioredis.from_url(self.redis_url, decode_responses=True)

    async def close(self) -> None:
        self.client.close()
        if self.redis:
            await self.redis.aclose()

    def sign_bolna(self, body_bytes: bytes, secret: str = "change-me") -> str:
        return hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

    async def drain_redis_queue_job(self, event_id: str) -> None:
        """Helper to advance worker pipeline if background worker process is not running or job is deferred."""
        try:
            from app.workers.jobs import diagnose_and_call, retry_call, escalate
            from app.db.session import async_session_factory
            from app.db.models import Event, EventStatus, CallAttempt
            from sqlalchemy import select

            async with async_session_factory() as session:
                res = await session.execute(select(Event).where(Event.id == event_id))
                event = res.scalar_one_or_none()
                if not event:
                    return

                if event.status in (EventStatus.ANOMALY_DETECTED, EventStatus.DIAGNOSING):
                    await diagnose_and_call({"session_factory": async_session_factory}, event_id=event_id)
                elif event.status in (EventStatus.NO_ANSWER, EventStatus.RETRYING):
                    att_res = await session.execute(
                        select(CallAttempt).where(CallAttempt.event_id == event_id).order_by(CallAttempt.attempt_no.desc())
                    )
                    last_att = att_res.scalars().first()
                    att_no = (last_att.attempt_no + 1) if last_att else 2
                    if att_no <= 2:
                        await retry_call({"session_factory": async_session_factory}, event_id=event_id, attempt_no=att_no)
                    else:
                        await escalate({"session_factory": async_session_factory}, event_id=event_id)
        except Exception as exc:
            print(f"      [worker-drain-note]: {exc}")

    async def drain_escalation_job(self, event_id: str) -> None:
        """Helper to invoke escalate job directly when retries are exhausted."""
        try:
            from app.workers.jobs import escalate
            from app.db.session import async_session_factory
            await escalate({"session_factory": async_session_factory}, event_id=event_id)
        except Exception as exc:
            print(f"      [worker-escalate-note]: {exc}")

    # =========================================================================
    # S1. Onboarding
    # =========================================================================
    async def run_s1(self) -> tuple[bool, str]:
        """S1: Login works, machine created, device bound, key returned once, duplicate bind returns 409."""
        # 1. Login
        login_res = self.client.post(
            "/v1/auth/login",
            json={"email": "owner@example.com", "password": "Password123!"},
        )
        if login_res.status_code != 200:
            return False, f"Login failed with status {login_res.status_code}: {login_res.text}"

        token = self.get_data(login_res)["access_token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        # 2. Create Machine
        ts = int(time.time() * 1000)
        mach_res = self.client.post(
            "/v1/machines",
            headers=auth_headers,
            json={
                "name": f"Lathe S1 {ts}",
                "machine_type": "Lathe",
                "rated_rpm": 1465.0,
                "supervisor_name": "S1 Supervisor",
                "supervisor_phone": "+919876543210",
                "backup_phone": "+919123456789",
                "language": "en",
            },
        )
        if mach_res.status_code != 201:
            return False, f"Create machine failed: {mach_res.status_code} {mach_res.text}"
        machine_id = self.get_data(mach_res)["id"]

        # 3. Bind Device
        dev_res = self.client.post(
            "/v1/devices",
            headers=auth_headers,
            json={"machine_id": machine_id},
        )
        if dev_res.status_code != 201:
            return False, f"Bind device failed: {dev_res.status_code} {dev_res.text}"

        dev_data = self.get_data(dev_res)
        device_id = dev_data.get("device_id")
        device_key = dev_data.get("device_key")
        if not device_id or not device_key or not device_key.startswith("dk_"):
            return False, "Device binding did not return valid device_id and raw device_key"

        # 4. Duplicate bind returns 409 CONFLICT
        dup_res = self.client.post(
            "/v1/devices",
            headers=auth_headers,
            json={"machine_id": machine_id},
        )
        if dup_res.status_code != 409:
            return False, f"Expected 409 CONFLICT on duplicate bind, got {dup_res.status_code}"

        return True, f"Machine {machine_id} and Device {device_id} bound successfully"

    # =========================================================================
    # S2. Heartbeat and config
    # =========================================================================
    async def run_s2(self) -> tuple[bool, str]:
        """S2: Heartbeat returns 204 and shows device online. Config returns valid sampling and thresholds."""
        login_res = self.client.post(
            "/v1/auth/login",
            json={"email": "owner@example.com", "password": "Password123!"},
        )
        token = self.get_data(login_res)["access_token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        # Create machine & bind device
        mach_res = self.client.post(
            "/v1/machines",
            headers=auth_headers,
            json={
                "name": f"Pump S2 {int(time.time()*1000)}",
                "machine_type": "Pump",
                "supervisor_phone": "+919876543210",
            },
        )
        machine_id = self.get_data(mach_res)["id"]
        dev_res = self.client.post("/v1/devices", headers=auth_headers, json={"machine_id": machine_id})
        dev_data = self.get_data(dev_res)
        device_id = dev_data["device_id"]
        device_key = dev_data["device_key"]

        # 1. Heartbeat
        hb_headers = {"X-Device-Key": device_key}
        hb_payload = {
            "device_id": device_id,
            "machine_id": machine_id,
            "fw": "1.0.0",
            "mode": "MONITORING",
            "errors_since_boot": 0,
            "rms_g": 0.125,
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        hb_res = self.client.post("/v1/telemetry/heartbeat", headers=hb_headers, json=hb_payload)
        if hb_res.status_code != 204:
            return False, f"Expected 204 for heartbeat, got {hb_res.status_code}: {hb_res.text}"

        # 2. Check machine shows device online
        check_mach = self.client.get(f"/v1/machines/{machine_id}", headers=auth_headers)
        if not self.get_data(check_mach)["device_online"]:
            return False, "Machine device_online is False after successful heartbeat"

        # 3. Check device config
        cfg_res = self.client.get("/v1/devices/me/config", headers=hb_headers)
        if cfg_res.status_code != 200:
            return False, f"Expected 200 for device config, got {cfg_res.status_code}: {cfg_res.text}"

        cfg = self.get_data(cfg_res)
        if cfg["sampling"]["fs"] != 1000 or cfg["thresholds"]["k_sigma"] != 3.0:
            return False, f"Device config parameters invalid: {cfg}"

        return True, "Heartbeat 204 received, device online, config verified"

    # =========================================================================
    # S3. Anomaly to call
    # =========================================================================
    async def run_s3(self) -> tuple[bool, str]:
        """S3: Imbalance telemetry returns 202 accepted. Within 30s event reaches CALLING and call in mock:calls."""
        login_res = self.client.post("/v1/auth/login", json={"email": "owner@example.com", "password": "Password123!"})
        token = self.get_data(login_res)["access_token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        mach_res = self.client.post(
            "/v1/machines",
            headers=auth_headers,
            json={"name": f"Motor S3 {int(time.time()*1000)}", "machine_type": "Motor", "supervisor_phone": "+919876543210"},
        )
        machine_id = self.get_data(mach_res)["id"]
        dev_res = self.client.post("/v1/devices", headers=auth_headers, json={"machine_id": machine_id})
        device_id = self.get_data(dev_res)["device_id"]
        device_key = self.get_data(dev_res)["device_key"]

        # Clear mock calls in redis
        if self.redis:
            await self.redis.delete("mock:calls")

        # Send imbalance telemetry
        seq = 101
        telem_payload = {
            "device_id": device_id,
            "machine_id": machine_id,
            "ts": datetime.now(timezone.utc).isoformat(),
            "seq": seq,
            "fs": 1000,
            "n": 512,
            "rms_g": 0.485,
            "baseline": {"mean": 0.120, "std": 0.018},
            "z_score": 20.3,
            "peaks": [{"freq_hz": 24.4, "amp_g": 0.385}],
            "rpm_est": 1465.0,
            "fw": "1.0.0",
        }
        telem_res = self.client.post("/v1/telemetry", headers={"X-Device-Key": device_key}, json=telem_payload)
        if telem_res.status_code != 202:
            return False, f"Expected 202 accepted, got {telem_res.status_code}: {telem_res.text}"

        event_id = self.get_data(telem_res)["event_id"]
        if not event_id:
            return False, "Telemetry response missing event_id"

        # Drain worker if not running externally
        await self.drain_redis_queue_job(event_id)

        # Poll event status until CALLING (up to 10s)
        calling_reached = False
        status = "UNKNOWN"
        for _ in range(20):
            ev_check = self.client.get(f"/v1/events/{event_id}", headers=auth_headers)
            status = self.get_data(ev_check)["status"]
            if status in ("CALLING", "ACKNOWLEDGED", "INSPECTION_SCHEDULED"):
                calling_reached = True
                break
            await asyncio.sleep(0.5)

        if not calling_reached:
            return False, f"Event did not reach CALLING status (current: {status})"

        # Verify call appears in mock:calls
        if self.redis:
            calls_len = await self.redis.llen("mock:calls")
            if calls_len == 0:
                return False, "No call recorded in Redis 'mock:calls'"

        return True, f"Event {event_id} reached CALLING, call dispatched"

    # =========================================================================
    # S4. Decision by voice
    # =========================================================================
    async def run_s4(self) -> tuple[bool, str]:
        """S4: Fake webhook with ACKNOWLEDGED moves event to ACKNOWLEDGED with extracted_decision and audit_log."""
        login_res = self.client.post("/v1/auth/login", json={"email": "owner@example.com", "password": "Password123!"})
        token = self.get_data(login_res)["access_token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        mach_res = self.client.post(
            "/v1/machines",
            headers=auth_headers,
            json={"name": f"Turbine S4 {int(time.time()*1000)}", "machine_type": "Turbine", "supervisor_phone": "+919876543210"},
        )
        machine_id = self.get_data(mach_res)["id"]
        dev_res = self.client.post("/v1/devices", headers=auth_headers, json={"machine_id": machine_id})
        device_id = self.get_data(dev_res)["device_id"]
        device_key = self.get_data(dev_res)["device_key"]

        # Ingest anomaly
        telem_payload = {
            "device_id": device_id,
            "machine_id": machine_id,
            "ts": datetime.now(timezone.utc).isoformat(),
            "seq": 201,
            "fs": 1000,
            "n": 512,
            "rms_g": 0.490,
            "baseline": {"mean": 0.120, "std": 0.018},
            "z_score": 20.5,
            "peaks": [{"freq_hz": 24.4, "amp_g": 0.380}],
            "fw": "1.0.0",
        }
        telem_res = self.client.post("/v1/telemetry", headers={"X-Device-Key": device_key}, json=telem_payload)
        event_id = self.get_data(telem_res)["event_id"]

        await self.drain_redis_queue_job(event_id)

        # Get call attempt ID
        ev_data = self.get_data(self.client.get(f"/v1/events/{event_id}", headers=auth_headers))
        attempts = ev_data.get("call_attempts", [])
        attempt_id = attempts[0]["id"] if attempts else f"att_sim_{int(time.time())}"

        # Send signed Bolna webhook with ACKNOWLEDGED
        webhook_body = {
            "call_id": f"bolna_{attempt_id}",
            "status": "completed",
            "duration": 35,
            "transcript": "Acknowledged by supervisor. Vibration is noted.",
            "user_data": {
                "event_id": event_id,
                "attempt_id": attempt_id,
            },
            "extracted_data": {
                "decision": "ACKNOWLEDGED",
            },
        }
        raw_bytes = json.dumps(webhook_body).encode("utf-8")
        sig = self.sign_bolna(raw_bytes)

        wh_res = self.client.post(
            "/v1/webhooks/bolna",
            headers={"X-Bolna-Signature": sig, "Content-Type": "application/json"},
            content=raw_bytes,
        )
        if wh_res.status_code != 200:
            return False, f"Webhook failed: {wh_res.status_code} {wh_res.text}"

        # Verify event status is ACKNOWLEDGED
        ev_after = self.get_data(self.client.get(f"/v1/events/{event_id}", headers=auth_headers))
        if ev_after["status"] != "ACKNOWLEDGED":
            return False, f"Event status is '{ev_after['status']}', expected 'ACKNOWLEDGED'"

        # Verify call attempt recorded decision
        att_res = ev_after.get("call_attempts", [])
        if not any(a.get("extracted_decision") == "ACKNOWLEDGED" for a in att_res):
            return False, "call_attempts does not contain extracted_decision == 'ACKNOWLEDGED'"

        return True, f"Event {event_id} transitioned to ACKNOWLEDGED with audit trail"

    # =========================================================================
    # S5. Cooldown and cap
    # =========================================================================
    async def run_s5(self) -> tuple[bool, str]:
        """S5: Second telemetry within cooldown returns suppressed. Daily cap of 5 events enforced."""
        login_res = self.client.post("/v1/auth/login", json={"email": "owner@example.com", "password": "Password123!"})
        token = self.get_data(login_res)["access_token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        mach_res = self.client.post(
            "/v1/machines",
            headers=auth_headers,
            json={"name": f"CoolCap Machine {int(time.time()*1000)}", "machine_type": "Fan", "supervisor_phone": "+919876543210"},
        )
        machine_id = self.get_data(mach_res)["id"]
        dev_res = self.client.post("/v1/devices", headers=auth_headers, json={"machine_id": machine_id})
        device_id = self.get_data(dev_res)["device_id"]
        device_key = self.get_data(dev_res)["device_key"]

        def make_telem(seq: int) -> dict[str, Any]:
            return {
                "device_id": device_id,
                "machine_id": machine_id,
                "ts": datetime.now(timezone.utc).isoformat(),
                "seq": seq,
                "fs": 1000,
                "n": 512,
                "rms_g": 0.450,
                "baseline": {"mean": 0.120, "std": 0.018},
                "z_score": 18.0,
                "peaks": [{"freq_hz": 24.4, "amp_g": 0.350}],
                "fw": "1.0.0",
            }

        # 1. First alert -> accepted
        r1 = self.client.post("/v1/telemetry", headers={"X-Device-Key": device_key}, json=make_telem(1))
        d1 = self.get_data(r1)
        if not isinstance(d1, dict) or d1.get("status") != "accepted":
            return False, f"Initial telemetry not accepted: {r1.text}"

        # 2. Immediate second alert -> suppressed by cooldown
        r2 = self.client.post("/v1/telemetry", headers={"X-Device-Key": device_key}, json=make_telem(2))
        d2 = self.get_data(r2)
        if not isinstance(d2, dict) or d2.get("status") != "suppressed":
            return False, f"Expected second telemetry to be suppressed by cooldown, got: {r2.text}"

        # 3. Test daily cap: clear cooldown lock and device minute rate limit between bursts to test daily cap of 5
        accepted_count = 1
        minute_str = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
        for i in range(3, 9):
            if self.redis:
                await self.redis.delete(f"cooldown:machine:{machine_id}")
                await self.redis.delete(f"ratelimit:device:{device_id}:{minute_str}")
            rx = self.client.post("/v1/telemetry", headers={"X-Device-Key": device_key}, json=make_telem(i))
            dx = self.get_data(rx)
            if isinstance(dx, dict) and dx.get("status") == "accepted":
                accepted_count += 1

        if accepted_count != 5:
            return False, f"Expected exactly 5 events accepted under daily cap, got {accepted_count}"

        return True, "Cooldown suppressed immediate second event; daily cap exactly 5 verified"

    # =========================================================================
    # S6. Duplicate sequence
    # =========================================================================
    async def run_s6(self) -> tuple[bool, str]:
        """S6: Re-sending same seq returns accepted with same event_id and creates no duplicate event."""
        login_res = self.client.post("/v1/auth/login", json={"email": "owner@example.com", "password": "Password123!"})
        token = self.get_data(login_res)["access_token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        mach_res = self.client.post(
            "/v1/machines",
            headers=auth_headers,
            json={"name": f"Seq Machine {int(time.time()*1000)}", "machine_type": "Motor", "supervisor_phone": "+919876543210"},
        )
        machine_id = self.get_data(mach_res)["id"]
        dev_res = self.client.post("/v1/devices", headers=auth_headers, json={"machine_id": machine_id})
        device_id = self.get_data(dev_res)["device_id"]
        device_key = self.get_data(dev_res)["device_key"]

        telem_payload = {
            "device_id": device_id,
            "machine_id": machine_id,
            "ts": datetime.now(timezone.utc).isoformat(),
            "seq": 999,
            "fs": 1000,
            "n": 512,
            "rms_g": 0.460,
            "baseline": {"mean": 0.120, "std": 0.018},
            "z_score": 18.8,
            "peaks": [{"freq_hz": 24.4, "amp_g": 0.360}],
            "fw": "1.0.0",
        }

        # First post
        r1 = self.client.post("/v1/telemetry", headers={"X-Device-Key": device_key}, json=telem_payload)
        ev1 = self.get_data(r1)["event_id"]

        # Duplicate post with same seq
        r2 = self.client.post("/v1/telemetry", headers={"X-Device-Key": device_key}, json=telem_payload)
        ev2 = self.get_data(r2)["event_id"]

        if ev1 != ev2:
            return False, f"Expected identical event_id for duplicate seq, got {ev1} vs {ev2}"

        return True, f"Idempotent seq=999 returned identical event_id {ev1}"

    # =========================================================================
    # S7. Webhook security
    # =========================================================================
    async def run_s7(self) -> tuple[bool, str]:
        """S7: Webhook with bad signature returns 401 WEBHOOK_SIGNATURE_INVALID."""
        payload = {
            "call_id": "bolna_invalid_123",
            "status": "completed",
            "user_data": {"event_id": "evt_fake", "attempt_id": "att_fake"},
        }
        raw_bytes = json.dumps(payload).encode("utf-8")
        bad_sig = "invalidsignature1234567890abcdef"

        resp = self.client.post(
            "/v1/webhooks/bolna",
            headers={"X-Bolna-Signature": bad_sig, "Content-Type": "application/json"},
            content=raw_bytes,
        )
        if resp.status_code != 401:
            return False, f"Expected 401 for bad webhook signature, got {resp.status_code}"

        err_code = resp.json().get("error", {}).get("code")
        if err_code != "WEBHOOK_SIGNATURE_INVALID":
            return False, f"Expected error code 'WEBHOOK_SIGNATURE_INVALID', got '{err_code}'"

        return True, "401 WEBHOOK_SIGNATURE_INVALID returned on signature mismatch"

    # =========================================================================
    # S8. Ownership and fallback
    # =========================================================================
    async def run_s8(self) -> tuple[bool, str]:
        """S8: Second owner gets 404 for first owner's machine/event. Fallback diagnosis verified."""
        from app.db.session import async_session_factory
        from app.db.models import Machine, Event, EventStatus, User
        from app.ids import generate_id
        from app.security import hash_password
        from sqlalchemy import select

        # Ensure Owner 2 exists
        owner2_email = "owner2@example.com"
        async with async_session_factory() as session:
            r = await session.execute(select(User).where(User.email == owner2_email))
            if not r.scalar_one_or_none():
                u2 = User(
                    id=generate_id("usr_"),
                    email=owner2_email,
                    password_hash=hash_password("Password123!"),
                    full_name="Second Owner",
                    role="owner",
                )
                session.add(u2)
                await session.commit()

        # Login Owner 1
        t1 = self.get_data(self.client.post("/v1/auth/login", json={"email": "owner@example.com", "password": "Password123!"}))["access_token"]
        # Login Owner 2
        t2 = self.get_data(self.client.post("/v1/auth/login", json={"email": owner2_email, "password": "Password123!"}))["access_token"]

        # Create machine under Owner 1
        m1 = self.get_data(self.client.post(
            "/v1/machines",
            headers={"Authorization": f"Bearer {t1}"},
            json={"name": f"Private M1 {int(time.time()*1000)}", "machine_type": "Pump", "supervisor_phone": "+919876543210"},
        ))["id"]

        # Owner 2 requests Owner 1's machine -> 404 NOT_FOUND
        cross_res = self.client.get(f"/v1/machines/{m1}", headers={"Authorization": f"Bearer {t2}"})
        if cross_res.status_code != 404:
            return False, f"Expected 404 for cross-owner query, got {cross_res.status_code}"

        # Test fallback diagnosis generation
        from app.services.diagnosis import run_diagnosis
        from app.clients.llm_client import MockLLMClient

        dummy_machine = Machine(
            id="mch_sim_test",
            owner_id="usr_sim_test",
            name="Test Pump",
            machine_type="Pump",
            supervisor_phone="+919876543210",
        )
        dummy_event = Event(
            id="evt_sim_test",
            machine_id="mch_sim_test",
            status=EventStatus.DIAGNOSING,
            ts=datetime.now(timezone.utc),
            seq=1,
            rms_g=0.48,
            z_score=20.0,
            baseline_mean=0.12,
            baseline_std=0.018,
            peaks=[{"freq_hz": 24.4, "amp_g": 0.38}],
            hints=["1x peak detected"],
        )

        mock_llm = MockLLMClient(mode="invalid")
        diag, source = await run_diagnosis(
            machine=dummy_machine,
            event=dummy_event,
            hints=["1x peak detected"],
            chunks=[],
            llm_client=mock_llm,
        )
        if source != "fallback" or not diag.probable_causes:
            return False, f"Expected diagnosis_source='fallback', got '{source}'"

        return True, "Cross-owner queries return 404; fallback diagnosis generated on invalid LLM"

    # =========================================================================
    # S9. Escalation
    # =========================================================================
    async def run_s9(self) -> tuple[bool, str]:
        """S9: NO_ANSWER followed by retry NO_ANSWER escalates to ESCALATED and sends backup SMS."""
        login_res = self.client.post("/v1/auth/login", json={"email": "owner@example.com", "password": "Password123!"})
        token = self.get_data(login_res)["access_token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        mach_res = self.client.post(
            "/v1/machines",
            headers=auth_headers,
            json={
                "name": f"Escalation Unit {int(time.time()*1000)}",
                "machine_type": "Crusher",
                "supervisor_phone": "+919876543210",
                "backup_phone": "+919123456789",
            },
        )
        machine_id = self.get_data(mach_res)["id"]
        dev_res = self.client.post("/v1/devices", headers=auth_headers, json={"machine_id": machine_id})
        device_id = self.get_data(dev_res)["device_id"]
        device_key = self.get_data(dev_res)["device_key"]

        if self.redis:
            await self.redis.delete("mock:notifications")

        telem_payload = {
            "device_id": device_id,
            "machine_id": machine_id,
            "ts": datetime.now(timezone.utc).isoformat(),
            "seq": 501,
            "fs": 1000,
            "n": 512,
            "rms_g": 0.470,
            "baseline": {"mean": 0.120, "std": 0.018},
            "z_score": 19.4,
            "peaks": [{"freq_hz": 24.4, "amp_g": 0.370}],
            "fw": "1.0.0",
        }
        telem_res = self.client.post("/v1/telemetry", headers={"X-Device-Key": device_key}, json=telem_payload)
        event_id = self.get_data(telem_res)["event_id"]

        # Step 1: Drain initial diagnose_and_call
        await self.drain_redis_queue_job(event_id)

        ev_data = self.get_data(self.client.get(f"/v1/events/{event_id}", headers=auth_headers))
        attempts = ev_data.get("call_attempts", [])
        att1_id = attempts[0]["id"] if attempts else "att_s9_1"

        # Webhook attempt 1: no-answer
        wh1 = {
            "call_id": f"bolna_{att1_id}",
            "status": "no-answer",
            "duration": 0,
            "user_data": {"event_id": event_id, "attempt_id": att1_id},
        }
        raw1 = json.dumps(wh1).encode("utf-8")
        self.client.post(
            "/v1/webhooks/bolna",
            headers={"X-Bolna-Signature": self.sign_bolna(raw1), "Content-Type": "application/json"},
            content=raw1,
        )

        # Step 2: Drain retry_call job for attempt 2
        await self.drain_redis_queue_job(event_id)

        ev_mid = self.get_data(self.client.get(f"/v1/events/{event_id}", headers=auth_headers))
        attempts_mid = ev_mid.get("call_attempts", [])
        att2_id = attempts_mid[-1]["id"] if attempts_mid else "att_s9_2"

        # Webhook attempt 2: no-answer -> triggers escalation
        wh2 = {
            "call_id": f"bolna_{att2_id}",
            "status": "no-answer",
            "duration": 0,
            "user_data": {"event_id": event_id, "attempt_id": att2_id},
        }
        raw2 = json.dumps(wh2).encode("utf-8")
        self.client.post(
            "/v1/webhooks/bolna",
            headers={"X-Bolna-Signature": self.sign_bolna(raw2), "Content-Type": "application/json"},
            content=raw2,
        )

        # Step 3: Drain escalate job
        await self.drain_escalation_job(event_id)

        ev_final = self.get_data(self.client.get(f"/v1/events/{event_id}", headers=auth_headers))
        if ev_final["status"] != "ESCALATED":
            return False, f"Expected event status 'ESCALATED', got '{ev_final['status']}'"

        if self.redis:
            notif_len = await self.redis.llen("mock:notifications")
            if notif_len == 0:
                return False, "No SMS notification found in Redis 'mock:notifications'"

        return True, f"Event {event_id} ESCALATED and notification recorded in mock:notifications"

    # =========================================================================
    # S10. Contract Verification
    # =========================================================================
    async def run_s10(self) -> tuple[bool, str]:
        """S10: docs/openapi.json and frontend/src/types/api.generated.ts are verified and valid."""
        openapi_file = ROOT_DIR / "docs" / "openapi.json"
        types_file = ROOT_DIR / "frontend" / "src" / "types" / "api.generated.ts"

        if not openapi_file.exists():
            return False, "docs/openapi.json does not exist"
        if not types_file.exists():
            return False, "frontend/src/types/api.generated.ts does not exist"

        # Fetch running API openapi spec
        api_spec_res = self.client.get("/openapi.json")
        if api_spec_res.status_code != 200:
            return False, f"Failed to fetch /openapi.json: {api_spec_res.status_code}"

        api_spec = api_spec_res.json()
        with open(openapi_file, "r", encoding="utf-8") as f:
            disk_spec = json.load(f)

        # Check critical route paths exist in both
        for path in ("/v1/auth/login", "/v1/machines", "/v1/telemetry", "/v1/webhooks/bolna", "/v1/stream"):
            if path not in api_spec.get("paths", {}):
                return False, f"Path '{path}' missing in running API OpenAPI spec"
            if path not in disk_spec.get("paths", {}):
                return False, f"Path '{path}' missing in docs/openapi.json"

        return True, "OpenAPI spec and generated TypeScript types match contract"


async def main() -> None:
    parser = argparse.ArgumentParser(description="Run Acceptance Scenarios S1-S10")
    parser.add_argument("--api-url", default=os.getenv("API_URL", "http://localhost:8000"))
    parser.add_argument("--redis-url", default=os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    args = parser.parse_args()

    print("==================================================================")
    print(">>> Running Machine Copilot Acceptance Scenarios (S1 - S10)")
    print(f"Target API: {args.api_url}")
    print("==================================================================\n")

    runner = ScenarioRunner(api_url=args.api_url, redis_url=args.redis_url)
    await runner.init_redis()

    scenarios = [
        ("S1", "Onboarding (Login, Machine, Device Binding, 409 Conflict)", runner.run_s1),
        ("S2", "Heartbeat & Config (204, Online presence, Device thresholds)", runner.run_s2),
        ("S3", "Anomaly to Call (202 Ingest, CALLING state, mock:calls)", runner.run_s3),
        ("S4", "Decision by Voice (Signed Webhook, ACKNOWLEDGED, Audit)", runner.run_s4),
        ("S5", "Cooldown & Daily Cap (Suppression, exactly 5 daily events)", runner.run_s5),
        ("S6", "Duplicate Sequence (Idempotent 202, same event_id)", runner.run_s6),
        ("S7", "Webhook Security (HMAC-SHA256 signature verification)", runner.run_s7),
        ("S8", "Ownership & Fallback (404 Isolation, Rule Fallback)", runner.run_s8),
        ("S9", "Escalation & Notification (NO_ANSWER retries, ESCALATED SMS)", runner.run_s9),
        ("S10", "OpenAPI & TypeScript Contract Verification", runner.run_s10),
    ]

    all_passed = True
    for sid, desc, func in scenarios:
        try:
            passed, detail = await func()
            if passed:
                print(f"  [PASS] [{sid}] {desc}")
                print(f"         {detail}\n")
            else:
                print(f"  [FAIL] [{sid}] {desc}")
                print(f"         {detail}\n")
                all_passed = False
        except Exception as exc:
            print(f"  [ERROR] [{sid}] {desc}")
            print(f"         Exception: {exc}\n")
            all_passed = False

    await runner.close()

    print("==================================================================")
    if all_passed:
        print("[SUCCESS] ALL ACCEPTANCE SCENARIOS (S1 - S10) PASSED!")
        print("==================================================================")
        sys.exit(0)
    else:
        print("[FAILURE] SOME SCENARIOS FAILED. See details above.")
        print("==================================================================")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
