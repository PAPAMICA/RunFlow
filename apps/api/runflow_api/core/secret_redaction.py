"""Secret redaction service."""

from __future__ import annotations

import re
from typing import Iterable


class SecretRedactor:
    def __init__(self, secret_values: Iterable[str] | None = None):
        self._values = [v for v in (secret_values or []) if v]
        self._patterns: list[re.Pattern[str]] = []
        for value in self._values:
            escaped = re.escape(value)
            self._patterns.append(re.compile(escaped))
        self._env_pattern = re.compile(
            r"(?i)([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|KEY|API_KEY)[A-Z0-9_]*)=([^\s'\"]+)"
        )

    def redact(self, text: str) -> str:
        result = text
        for pattern in self._patterns:
            result = pattern.sub("********", result)
        result = self._env_pattern.sub(r"\1=********", result)
        return result

    def redact_dict(self, data: dict) -> dict:
        redacted = {}
        for key, value in data.items():
            if isinstance(value, str):
                redacted[key] = self.redact(value)
            elif isinstance(value, dict):
                redacted[key] = self.redact_dict(value)
            else:
                redacted[key] = value
        return redacted
