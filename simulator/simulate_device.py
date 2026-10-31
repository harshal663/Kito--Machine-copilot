#!/usr/bin/env python3
"""ESP32 Sensor Node Simulator.

Generates TelemetryIn-compliant payloads matching physical device characteristics
for healthy and anomalous vibration conditions.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
import sys
import time
from typing import Any

import httpx


def build_telemetry_payload(
    device_id: str,
    machine_id: str,
    mode: str,
    seq: int,
    rpm: float = 1465.0,
) -> dict[str, Any]:
    """Construct a TelemetryIn-compliant payload."""
    now_iso = datetime.now(timezone.utc).isoformat()
    f0 = rpm / 60.0  # Fundamental frequency (e.g. 24.417 Hz for 1465 RPM)

    if mode == "healthy":
        rms_g = 0.122
        baseline_mean = 0.120
        baseline_std = 0.018
        z_score = 0.1
        peaks = [
            {"freq_hz": round(f0, 1), "amp_g": 0.045},
            {"freq_hz": round(2 * f0, 1), "amp_g": 0.018},
            {"freq_hz": 100.0, "amp_g": 0.012},
        ]
    elif mode == "imbalance":
        rms_g = 0.485
        baseline_mean = 0.120
        baseline_std = 0.018
        z_score = round((rms_g - baseline_mean) / baseline_std, 1)  # ~20.3
        peaks = [
            {"freq_hz": round(f0, 1), "amp_g": 0.385},  # Strong 1x peak
            {"freq_hz": round(2 * f0, 1), "amp_g": 0.045},
            {"freq_hz": round(3 * f0, 1), "amp_g": 0.021},
        ]
    elif mode == "misalignment":
        rms_g = 0.450
        baseline_mean = 0.120
        baseline_std = 0.018
        z_score = round((rms_g - baseline_mean) / baseline_std, 1)
        peaks = [
            {"freq_hz": round(2 * f0, 1), "amp_g": 0.360},  # Dominant 2x peak
            {"freq_hz": round(f0, 1), "amp_g": 0.080},
            {"freq_hz": round(3 * f0, 1), "amp_g": 0.035},
        ]
    elif mode == "looseness":
        rms_g = 0.420
        baseline_mean = 0.120
        baseline_std = 0.018
        z_score = round((rms_g - baseline_mean) / baseline_std, 1)
        peaks = [
            {"freq_hz": round(f0, 1), "amp_g": 0.180},
            {"freq_hz": round(2 * f0, 1), "amp_g": 0.160},
            {"freq_hz": round(3 * f0, 1), "amp_g": 0.140},
            {"freq_hz": round(4 * f0, 1), "amp_g": 0.110},
        ]
    else:
        raise ValueError(f"Unknown simulation mode: {mode}")

    return {
        "device_id": device_id,
        "machine_id": machine_id,
        "ts": now_iso,
        "seq": seq,
        "fs": 1000,
        "n": 512,
        "rms_g": rms_g,
        "baseline": {
            "mean": baseline_mean,
            "std": baseline_std,
        },
        "z_score": z_score,
        "peaks": peaks,
        "rpm_est": rpm,
        "fw": "1.0.0",
    }


def build_heartbeat_payload(
    device_id: str,
    machine_id: str,
    mode: str = "MONITORING",
    rms_g: float = 0.120,
) -> dict[str, Any]:
    """Construct a HeartbeatIn-compliant payload."""
    return {
        "device_id": device_id,
        "machine_id": machine_id,
        "fw": "1.0.0",
        "mode": mode,
        "errors_since_boot": 0,
        "rms_g": rms_g,
        "ts": datetime.now(timezone.utc).isoformat(),
    }


def send_telemetry(
    api_url: str,
    device_key: str,
    payload: dict[str, Any],
) -> httpx.Response:
    """Post telemetry payload to API endpoint."""
    url = f"{api_url.rstrip('/')}/v1/telemetry"
    headers = {
        "X-Device-Key": device_key,
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=10.0) as client:
        return client.post(url, headers=headers, json=payload)


def send_heartbeat(
    api_url: str,
    device_key: str,
    payload: dict[str, Any],
) -> httpx.Response:
    """Post heartbeat payload to API endpoint."""
    url = f"{api_url.rstrip('/')}/v1/telemetry/heartbeat"
    headers = {
        "X-Device-Key": device_key,
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=10.0) as client:
        return client.post(url, headers=headers, json=payload)


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulate ESP32 machine sensor node")
    parser.add_argument("--api-url", default=os.getenv("API_URL", "http://localhost:8000"), help="API Base URL")
    parser.add_argument("--device-id", default=os.getenv("DEVICE_ID", "dev_01HZX3K2M9V4Q8R7T1Y6N0P5CB"))
    parser.add_argument("--device-key", default=os.getenv("DEVICE_KEY", "dk_ChangeMeTo32BytesBase64SecretKeyHere12"))
    parser.add_argument("--machine-id", default=os.getenv("MACHINE_ID", "mch_01HZX3K2M9V4Q8R7T1Y6N0P5CB"))
    parser.add_argument("--mode", choices=["healthy", "imbalance", "misalignment", "looseness"], default="imbalance")
    parser.add_argument("--fault", choices=["imbalance", "misalignment", "looseness"], default=None, help="Fault alias for mode")
    parser.add_argument("--rpm", type=float, default=1465.0, help="Rated RPM for peak simulation")
    parser.add_argument("--seq", type=int, default=1, help="Starting sequence number")
    parser.add_argument("--count", type=int, default=1, help="Number of payloads to send")
    parser.add_argument("--interval", type=float, default=1.0, help="Interval between payloads in seconds")
    parser.add_argument("--heartbeat", action="store_true", help="Send heartbeat instead of telemetry")

    args = parser.parse_args()

    selected_mode = args.fault or args.mode

    for i in range(args.count):
        curr_seq = args.seq + i
        if args.heartbeat:
            payload = build_heartbeat_payload(args.device_id, args.machine_id)
            resp = send_heartbeat(args.api_url, args.device_key, payload)
            print(f"[{i + 1}/{args.count}] Heartbeat -> HTTP {resp.status_code}")
        else:
            payload = build_telemetry_payload(args.device_id, args.machine_id, selected_mode, curr_seq, args.rpm)
            resp = send_telemetry(args.api_url, args.device_key, payload)
            print(f"[{i + 1}/{args.count}] Telemetry (seq={curr_seq}, mode={args.mode}) -> HTTP {resp.status_code}: {resp.text}")

        if i < args.count - 1 and args.interval > 0:
            time.sleep(args.interval)


if __name__ == "__main__":
    main()

