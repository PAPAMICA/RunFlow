"""Tests for API key security."""

from runflow_api.core.security import hash_password, verify_password, verify_api_key_hash
from runflow_api.utils import generate_api_key, hash_api_key


def test_password_hash_verify():
    hashed = hash_password("test-password-123")
    assert verify_password("test-password-123", hashed)
    assert not verify_password("wrong", hashed)


def test_api_key_generation_and_verify():
    full_key, prefix, key_hash = generate_api_key()
    assert full_key.startswith("rf_live_")
    assert len(prefix) == 16
    assert verify_api_key_hash(full_key, key_hash)
    assert not verify_api_key_hash("rf_live_wrong", key_hash)
