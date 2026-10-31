"""Smoke test for Cloudflare Workers AI. Not used by the app. Do not commit output."""

import os
from dotenv import load_dotenv
import sys

load_dotenv()

import requests

ACCOUNT_ID = os.environ["CLOUDFLARE_ACCOUNT_ID"]
AUTH_TOKEN = os.environ["CLOUDFLARE_AUTH_TOKEN"]
MODEL = os.environ.get("LLM_MODEL", "@cf/meta/llama-3.1-8b-instruct-fp8")

URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/{MODEL}"

payload = {
    "messages": [
        {"role": "system", "content": "You are a friendly assistant"},
        {"role": "user", "content": "Tell me in two sentences what PEP 8 is."},
    ],
    "max_tokens": 120,
}

try:
    response = requests.post(
        URL,
        headers={"Authorization": f"Bearer {AUTH_TOKEN}"},
        json=payload,
        timeout=20,
    )
except requests.RequestException as exc:
    sys.exit(f"Network error: {type(exc).__name__}")

print("HTTP status:", response.status_code)
body = response.json()

if not body.get("success", False):
    # Print error codes only. Do not print the full body, in case it echoes input.
    codes = [err.get("code") for err in body.get("errors", [])]
    sys.exit(f"Cloudflare returned an error. Codes: {codes}")

print("Model text:")
print(body["result"]["response"])