"""Webhook authentication verification."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from typing import Any


def verify_webhook_auth(
    auth_type: str,
    auth_config: dict[str, Any],
    headers: dict[str, str],
    body: bytes,
    authorization: str | None = None,
) -> bool:
    if auth_type == "none":
        return True

    if auth_type == "bearer":
        expected = auth_config.get("token", "")
        if not authorization or not authorization.startswith("Bearer "):
            return False
        return secrets.compare_digest(authorization.removeprefix("Bearer ").strip(), expected)

    if auth_type == "secret_header":
        header_name = auth_config.get("header", "X-Webhook-Secret").lower()
        expected = auth_config.get("secret", "")
        actual = headers.get(header_name, "")
        return secrets.compare_digest(actual, expected)

    if auth_type == "hmac_sha256":
        header_name = auth_config.get("header", "X-Signature-256").lower()
        secret = auth_config.get("secret", "").encode()
        signature = headers.get(header_name, "")
        if signature.startswith("sha256="):
            signature = signature[7:]
        expected = hmac.new(secret, body, hashlib.sha256).hexdigest()
        return secrets.compare_digest(signature, expected)

    return False
