#!/usr/bin/env python3
"""Fake Bolna Webhook Simulator.

Constructs signed webhook payloads matching Bolna agent call execution outcomes
and posts them to /v1/webhooks/bolna.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import sys
from typing import Any

import httpx


def build_bolna_payload(
    event_id: str,
    attempt_id: str,
    status: str = "completed",
    decision: str | None = "ACKNOWLEDGED",
    call_id: str | None = None,
    transcript: str | None = None,
    duration_s: int = 42,
) -> dict[str, Any]:
    """Construct a Bolna call completion webhook body."""
    actual_call_id = call_id or f"bolna_sim_{attempt_id}"
    actual_transcript = transcript or (
        f"Operator response: Machine anomalous vibration received. Decision is {decision}."
        if decision
        else "Operator did not answer the phone."
    )

    return {
        "call_id": actual_call_id,
        "status": status,
        "duration": duration_s,
        "transcript": actual_transcript,
        "user_data": {
            "event_id": event_id,
            "attempt_id": attempt_id,
        },
        "extracted_data": {
            "decision": decision,
        }
        if decision
        else {},
    }


def compute_hmac_signature(raw_body: bytes, secret: str) -> str:
    """Compute HMAC-SHA256 signature."""
    mac = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256)
    return mac.hexdigest()


def post_webhook(
    api_url: str,
    payload: dict[str, Any],
    secret: str,
    header_name: str = "X-Bolna-Signature",
    bad_signature: bool = False,
) -> httpx.Response:
    """Sign and post webhook to API endpoint."""
    url = f"{api_url.rstrip('/')}/v1/webhooks/bolna"
    raw_body = json.dumps(payload).encode("utf-8")

    if bad_signature:
        signature = "invalidsignature0123456789abcdef"
    else:
        signature = compute_hmac_signature(raw_body, secret)

    headers = {
        header_name: signature,
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=10.0) as client:
        return client.post(url, headers=headers, content=raw_body)


def main() -> None:
    parser = argparse.ArgumentParser(description="Send signed fake Bolna webhook to Machine Copilot API")
    parser.add_argument("--api-url", default=os.getenv("API_URL", "http://localhost:8000"), help="API Base URL")
    parser.add_argument("--event-id", required=True, help="Target event ID (evt_...)")
    parser.add_argument("--attempt-id", required=True, help="Target call attempt ID (att_...)")
    parser.add_argument(
        "--decision",
        choices=["ACKNOWLEDGED", "INSPECTION_SCHEDULED", "SHUTDOWN_REQUESTED", "NONE"],
        default="ACKNOWLEDGED",
        help="Operator spoken decision",
    )
    parser.add_argument(
        "--status",
        choices=["completed", "no-answer", "busy", "failed"],
        default="completed",
        help="Call status outcome",
    )
    parser.add_argument("--call-id", default=None, help="Optional provider call ID")
    parser.add_argument("--transcript", default=None, help="Optional spoken transcript")
    parser.add_argument("--secret", default=os.getenv("BOLNA_WEBHOOK_SECRET", "change-me"), help="Webhook secret")
    parser.add_argument("--header", default="X-Bolna-Signature", help="Signature header name")
    parser.add_argument("--bad-signature", action="store_true", help="Send deliberately invalid signature")

    args = parser.parse_args()

    actual_decision = None if args.decision == "NONE" else args.decision
    payload = build_bolna_payload(
        event_id=args.event_id,
        attempt_id=args.attempt_id,
        status=args.status,
        decision=actual_decision,
        call_id=args.call_id,
        transcript=args.transcript,
    )

    resp = post_webhook(
        api_url=args.api_url,
        payload=payload,
        secret=args.secret,
        header_name=args.header,
        bad_signature=args.bad_signature,
    )

    print(f"Webhook -> HTTP {resp.status_code}: {resp.text}")
    if resp.status_code >= 400:
        sys.exit(1)


if __name__ == "__main__":
    main()

