"""Tests for secret redaction."""

from runflow_api.core.secret_redaction import SecretRedactor


def test_redact_known_secret():
    redactor = SecretRedactor(["abcd1234secret"])
    assert "********" in redactor.redact("token=abcd1234secret")


def test_redact_env_pattern():
    redactor = SecretRedactor()
    result = redactor.redact("CLOUDFLARE_API_TOKEN=abcd1234")
    assert "CLOUDFLARE_API_TOKEN=********" in result
    assert "abcd1234" not in result


def test_redact_dict():
    redactor = SecretRedactor(["mysecret"])
    data = {"password": "mysecret", "name": "test"}
    redacted = redactor.redact_dict(data)
    assert redacted["password"] == "********"
    assert redacted["name"] == "test"
