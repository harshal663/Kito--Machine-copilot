"""Unit tests for core backend utilities per Phase P1."""

from datetime import timedelta

import pytest

from app.config import Settings
from app.errors import UnauthenticatedError
from app.ids import generate_id, generate_ulid, is_valid_id
from app.logging import mask_phone
from app.security import (
    create_access_token,
    decode_access_token,
    generate_device_key,
    hash_device_key,
    hash_password,
    verify_device_key,
    verify_hmac_signature,
    verify_password,
)


def test_ulid_format_and_prefixes() -> None:
    """Verify generated IDs have correct prefixes and 26-char Crockford base32 ULID."""
    prefixes = ["mch_", "dev_", "man_", "evt_", "cal_", "usr_", "req_"]
    for prefix in prefixes:
        id_val = generate_id(prefix)
        assert id_val.startswith(prefix)
        assert len(id_val) == len(prefix) + 26
        assert is_valid_id(id_val, prefix)
        # Check invalid prefix rejected
        assert not is_valid_id(id_val, "invalid_")


def test_ulid_monotonicity() -> None:
    """Verify ULIDs generated in rapid succession are monotonically increasing."""
    ids = [generate_ulid() for _ in range(100)]
    assert ids == sorted(ids)
    assert len(set(ids)) == 100


def test_password_hashing() -> None:
    """Verify argon2id hashing and verification."""
    password = "SuperSecretPassword123!"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("WrongPassword", hashed)


def test_jwt_issuance_and_decoding() -> None:
    """Verify JWT creation and decoding with claims."""
    token = create_access_token(
        user_id="usr_01HZX3K2M9V4Q8R7T1Y6N0P5CB",
        role="owner",
        email="owner@example.com",
    )
    payload = decode_access_token(token)
    assert payload["sub"] == "usr_01HZX3K2M9V4Q8R7T1Y6N0P5CB"
    assert payload["role"] == "owner"
    assert payload["email"] == "owner@example.com"


def test_jwt_expiry() -> None:
    """Verify expired token raises UnauthenticatedError."""
    token = create_access_token(
        user_id="usr_01HZX3K2M9V4Q8R7T1Y6N0P5CB",
        role="owner",
        email="owner@example.com",
        expires_delta=timedelta(seconds=-10),
    )
    with pytest.raises(UnauthenticatedError):
        decode_access_token(token)


def test_device_key_lifecycle() -> None:
    """Verify device key generation, hash stability, and constant-time check."""
    key = generate_device_key()
    assert key.startswith("dk_")
    assert len(key) > 40

    hash1 = hash_device_key(key)
    hash2 = hash_device_key(key)
    assert hash1 == hash2
    assert len(hash1) == 64

    assert verify_device_key(key, hash1)
    assert not verify_device_key("dk_wrongkey", hash1)


def test_hmac_signature_verification() -> None:
    """Verify HMAC-SHA256 signature matching and mismatch rejection."""
    import hashlib
    import hmac

    secret = "my-webhook-secret-key"
    body = b'{"event": "call.completed", "status": "ok"}'
    valid_sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    assert verify_hmac_signature(body, valid_sig, secret)
    assert verify_hmac_signature(body, f"sha256={valid_sig}", secret)
    assert not verify_hmac_signature(body, "invalidsignature123", secret)
    assert not verify_hmac_signature(b'{"different": "body"}', valid_sig, secret)
    assert not verify_hmac_signature(body, valid_sig, "wrong-secret")


def test_phone_masking() -> None:
    """Verify phone masking reveals only the last 4 digits."""
    assert mask_phone("+919876543210") == "*********3210"
    assert mask_phone("1234") == "1234"
    assert mask_phone(None) == "****"


def test_settings_validation_in_non_mock_mode() -> None:
    """Verify settings fail fast when required keys are missing in non-mock mode."""
    with pytest.raises(ValueError, match="MOCK_EXTERNALS is false but required keys are missing"):
        Settings(
            MOCK_EXTERNALS=False,
            LLM_API_KEY="",
            BOLNA_API_KEY="",
            BOLNA_AGENT_ID="",
        )
