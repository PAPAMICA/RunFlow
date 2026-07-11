"""Phase 2-5 tests."""

import hashlib
import hmac
import json
import os

import pytest

from runflow_api.core.condition_evaluator import evaluate_condition
from runflow_api.core.encryption import decrypt, encrypt
from runflow_api.core.template_engine import render_argument_mapping, render_template
from runflow_api.core.webhook_auth import verify_webhook_auth
from runflow_api.services.ai.gateway import validate_ai_changes
from runflow_api.services.email_poller import _match_conditions


def test_encrypt_decrypt(monkeypatch):
    monkeypatch.setenv("RUNFLOW_MASTER_KEY", "test-master-key-for-encryption")
    from runflow_api.config import get_settings
    get_settings.cache_clear()
    ct, nonce = encrypt("my-secret-value")
    assert decrypt(ct, nonce) == "my-secret-value"


def test_render_template():
    result = render_template("Hello {{ name }}", {"name": "World"})
    assert result == "Hello World"


def test_render_argument_mapping():
    mapping = {"domain": "{{ webhook.body.domain }}"}
    ctx = {"webhook": {"body": {"domain": "example.com"}}}
    result = render_argument_mapping(mapping, ctx)
    assert result["domain"] == "example.com"


def test_webhook_hmac_auth():
    secret = "test-secret"
    body = b'{"name": "test"}'
    sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    headers = {"x-signature-256": f"sha256={sig}"}
    assert verify_webhook_auth("hmac_sha256", {"secret": secret}, headers, body)


def test_email_condition_match():
    msg = {"from": "client@example.com", "subject": "migration plan"}
    conditions = {
        "operator": "AND",
        "conditions": [
            {"field": "FROM", "operator": "contains", "value": "@example.com"},
            {"field": "SUBJECT", "operator": "contains", "value": "migration"},
        ],
    }
    assert _match_conditions(msg, conditions) is True


def test_condition_evaluator():
    ctx = {"jobs": {"check": {"status": "success", "result": {"cms": "wordpress"}}}}
    assert evaluate_condition('jobs.check.status == "success"', ctx)
    assert evaluate_condition('jobs.check.result.cms == "wordpress"', ctx)


def test_ai_change_validation():
    changes = [{"path": "main.py", "content": "print('hi')"}]
    assert validate_ai_changes(changes) == changes

    with pytest.raises(ValueError):
        validate_ai_changes([{"path": "../etc/passwd", "content": "hack"}])
