"""Safe condition evaluator without eval."""

from __future__ import annotations

import re
from typing import Any


def _get_nested(data: dict, path: str) -> Any:
    parts = path.split(".")
    current: Any = data
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def evaluate_condition(expression: str, context: dict[str, Any]) -> bool:
    """Evaluate simple conditions like jobs.check.status == \"success\"."""
    expression = expression.strip()
    match = re.match(r'^jobs\.(\w+)\.status\s*==\s*"(.+)"$', expression)
    if match:
        slug, expected = match.groups()
        jobs = context.get("jobs", {})
        job_data = jobs.get(slug, {})
        return str(job_data.get("status", "")) == expected

    match = re.match(r'^jobs\.(\w+)\.result\.(\w+)\s*==\s*"(.+)"$', expression)
    if match:
        slug, field, expected = match.groups()
        jobs = context.get("jobs", {})
        result = jobs.get(slug, {}).get("result") or {}
        if isinstance(result, dict):
            return str(result.get(field, "")) == expected
        return False

    match = re.match(r'^jobs\.(\w+)\.result\.(\w+)\s*==\s*(true|false)$', expression, re.I)
    if match:
        slug, field, expected = match.groups()
        jobs = context.get("jobs", {})
        result = jobs.get(slug, {}).get("result") or {}
        if isinstance(result, dict):
            val = result.get(field)
            return bool(val) == (expected.lower() == "true")
        return False

    # Fallback: check if path exists and is truthy
    if expression.startswith("jobs."):
        val = _get_nested(context, expression.replace("jobs.", "jobs."))
        return bool(val)

    return False
