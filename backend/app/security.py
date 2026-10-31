"""Security utilities: password hashing, JWT, device keys, and HMAC verification."""

import base64
import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.config import settings
from app.errors import UnauthenticatedError
from app.ids import generate_id

_ph = PasswordHasher()
DUMMY_PASSWORD_HASH: str = _ph.hash("dummy_constant_time_verification_hash")


def hash_password(password: str) -> str:
    """Hash a password using argon2id."""
    return _ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against an argon2id hash."""
    try:
        return _ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def create_access_token(
    user_id: str,
    role: str,
    email: str,
    expires_delta: timedelta | None = None,
) -> str:
    """Issue a signed JWT token with HS256."""
    now = datetime.now(UTC)
    if expires_delta is not None:
        expire = now + expires_delta
    else:
        expire = now + timedelta(hours=settings.JWT_EXPIRES_HOURS)

    payload: dict[str, Any] = {
        "sub": user_id,
        "role": role,
        "email": email,
        "jti": generate_id("jti_"),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any]:
    """Verify and decode a JWT access token."""
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            options={"require": ["sub", "exp", "iat"]},
        )
        return payload
    except jwt.PyJWTError as exc:
        raise UnauthenticatedError(message="Invalid or expired token.") from exc


def generate_device_key() -> str:
    """Generate a high-entropy device key: 32 random bytes, URL-safe base64, prefixed with dk_."""
    raw_bytes = secrets.token_bytes(32)
    b64 = base64.urlsafe_b64encode(raw_bytes).decode("utf-8").rstrip("=")
    return f"dk_{b64}"


def hash_device_key(device_key: str) -> str:
    """Compute the SHA-256 hex digest of a device key for secure storage."""
    return hashlib.sha256(device_key.encode("utf-8")).hexdigest()


def verify_device_key(raw_key: str, expected_hash: str) -> bool:
    """Constant-time comparison between raw device key hash and expected stored hash."""
    computed_hash = hash_device_key(raw_key)
    return hmac.compare_digest(computed_hash, expected_hash)


def verify_hmac_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    """Verify HMAC-SHA256 signature over raw request body using constant-time comparison."""
    if not signature or not secret:
        return False
    mac = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256)
    expected_hex = mac.hexdigest()
    # Normalize potential prefix like sha256=
    sig = signature.removeprefix("sha256=").strip()
    return hmac.compare_digest(expected_hex, sig)
