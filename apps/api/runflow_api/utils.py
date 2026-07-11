"""Utility helpers."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime
from pathlib import Path

from ulid import ULID

from runflow_shared import API_KEY_PREFIX, REGISTRATION_TOKEN_PREFIX, WORKER_TOKEN_PREFIX


def new_ulid() -> str:
    return str(ULID())


def utcnow() -> datetime:
    return datetime.now(UTC)


def generate_api_key() -> tuple[str, str, str]:
    """Return (full_key, prefix, hash)."""
    token = secrets.token_urlsafe(32)
    full_key = f"{API_KEY_PREFIX}{token}"
    prefix = full_key[:16]
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    return full_key, prefix, key_hash


def hash_api_key(full_key: str) -> str:
    return hashlib.sha256(full_key.encode()).hexdigest()


def generate_worker_token() -> tuple[str, str, str]:
    token = secrets.token_urlsafe(32)
    full_token = f"{WORKER_TOKEN_PREFIX}{token}"
    prefix = full_token[:16]
    token_hash = hashlib.sha256(full_token.encode()).hexdigest()
    return full_token, prefix, token_hash


def hash_worker_token(full_token: str) -> str:
    return hashlib.sha256(full_token.encode()).hexdigest()


def generate_registration_token() -> tuple[str, str, str]:
    token = secrets.token_urlsafe(32)
    full_token = f"{REGISTRATION_TOKEN_PREFIX}{token}"
    prefix = full_token[:16]
    token_hash = hashlib.sha256(full_token.encode()).hexdigest()
    return full_token, prefix, token_hash


def hash_registration_token(full_token: str) -> str:
    return hashlib.sha256(full_token.encode()).hexdigest()


def safe_join(base: Path, *parts: str) -> Path:
    """Join paths and ensure result stays within base (anti path traversal)."""
    base = base.resolve()
    candidate = (base.joinpath(*parts)).resolve()
    if not str(candidate).startswith(str(base)):
        raise ValueError("Path traversal detected")
    return candidate
