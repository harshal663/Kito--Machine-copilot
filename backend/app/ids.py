"""Prefixed monotonic ULID generator per ARCHITECTURE.md §3.1."""

import re
import secrets
import threading
import time

CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
PREFIXES = ("mch_", "dev_", "man_", "evt_", "cal_", "usr_", "req_", "fac_")

_lock = threading.Lock()
_last_time_ms = 0
_last_randomness = 0


def _encode_crockford(value: int, length: int) -> str:
    """Encode an integer into fixed-length Crockford base32."""
    chars: list[str] = []
    for _ in range(length):
        chars.append(CROCKFORD_ALPHABET[value & 0x1F])
        value >>= 5
    return "".join(reversed(chars))


def generate_ulid() -> str:
    """Generate a monotonic 26-character Crockford Base32 ULID."""
    global _last_time_ms, _last_randomness
    with _lock:
        now_ms = int(time.time() * 1000)
        if now_ms <= _last_time_ms:
            now_ms = _last_time_ms
            _last_randomness = (_last_randomness + 1) & ((1 << 80) - 1)
        else:
            _last_time_ms = now_ms
            _last_randomness = secrets.randbits(80)

        time_part = _encode_crockford(now_ms, 10)
        rand_part = _encode_crockford(_last_randomness, 16)
        return f"{time_part}{rand_part}"


def generate_id(prefix: str) -> str:
    """Generate a prefixed ULID (e.g., mch_01HZX3K2M9V4Q8R7T1Y6N0P5CB)."""
    return f"{prefix}{generate_ulid()}"


def is_valid_id(value: str, prefix: str) -> bool:
    """Verify if value matches the prefixed ULID pattern."""
    pattern = rf"^{re.escape(prefix)}[0-9A-HJKMNP-TV-Z]{{26}}$"
    return bool(re.match(pattern, value))
