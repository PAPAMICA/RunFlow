"""AES-256-GCM encryption for secrets and credentials."""

from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from runflow_api.config import get_settings


class EncryptionError(Exception):
    pass


def _get_key() -> bytes:
    settings = get_settings()
    if not settings.runflow_master_key:
        raise EncryptionError("RUNFLOW_MASTER_KEY is not configured")
    import hashlib
    return hashlib.sha256(settings.runflow_master_key.encode()).digest()


def encrypt(plaintext: str) -> tuple[str, str]:
    """Return (ciphertext_b64, nonce_b64)."""
    key = _get_key()
    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    ct = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(ct).decode(), base64.b64encode(nonce).decode()


def decrypt(ciphertext_b64: str, nonce_b64: str) -> str:
    key = _get_key()
    aesgcm = AESGCM(key)
    ct = base64.b64decode(ciphertext_b64)
    nonce = base64.b64decode(nonce_b64)
    return aesgcm.decrypt(nonce, ct, None).decode("utf-8")
