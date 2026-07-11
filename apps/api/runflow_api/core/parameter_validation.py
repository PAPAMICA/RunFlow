"""Job parameter validation."""

from __future__ import annotations

import ipaddress
import json
import re
from datetime import date, datetime
from typing import Any
from urllib.parse import urlparse

from pydantic import BaseModel, EmailStr, Field, ValidationError, create_model

from runflow_api.models import JobParameter
from runflow_shared import ParameterType


class ParameterValidationError(Exception):
    def __init__(self, errors: dict[str, str]):
        self.errors = errors
        super().__init__(str(errors))


def _coerce_value(param: JobParameter, raw: Any) -> Any:
    ptype = param.param_type
    if raw is None:
        if param.required:
            raise ValueError("required")
        return param.default_value

    if ptype == ParameterType.STRING:
        return str(raw)
    if ptype == ParameterType.INTEGER:
        return int(raw)
    if ptype == ParameterType.FLOAT:
        return float(raw)
    if ptype == ParameterType.BOOLEAN:
        if isinstance(raw, bool):
            return raw
        return str(raw).lower() in {"1", "true", "yes", "on"}
    if ptype == ParameterType.SELECT:
        value = str(raw)
        if param.options and value not in param.options:
            raise ValueError(f"must be one of {param.options}")
        return value
    if ptype == ParameterType.MULTI_SELECT:
        values = raw if isinstance(raw, list) else [raw]
        values = [str(v) for v in values]
        if param.options and any(v not in param.options for v in values):
            raise ValueError(f"must be subset of {param.options}")
        return values
    if ptype == ParameterType.SECRET:
        return str(raw)
    if ptype == ParameterType.JSON:
        if isinstance(raw, (dict, list)):
            return raw
        return json.loads(str(raw))
    if ptype == ParameterType.FILE:
        return str(raw)
    if ptype == ParameterType.DATE:
        if isinstance(raw, date):
            return raw.isoformat()
        return str(raw)
    if ptype == ParameterType.DATETIME:
        return str(raw)
    if ptype == ParameterType.EMAIL:
        from pydantic import TypeAdapter
        TypeAdapter(EmailStr).validate_python(str(raw))
        return str(raw)
    if ptype == ParameterType.URL:
        parsed = urlparse(str(raw))
        if not parsed.scheme or not parsed.netloc:
            raise ValueError("invalid url")
        return str(raw)
    if ptype == ParameterType.IP:
        ipaddress.ip_address(str(raw))
        return str(raw)
    if ptype == ParameterType.CIDR:
        ipaddress.ip_network(str(raw), strict=False)
        return str(raw)
    if ptype == ParameterType.RAW:
        return raw
    return raw


def validate_job_arguments(
    parameters: list[JobParameter], arguments: dict[str, Any] | None
) -> dict[str, Any]:
    arguments = arguments or {}
    errors: dict[str, str] = {}
    validated: dict[str, Any] = {}

    for param in sorted(parameters, key=lambda p: p.position):
        raw = arguments.get(param.name)
        if raw is None and param.name not in arguments:
            raw = None
        try:
            validated[param.name] = _coerce_value(param, raw)
        except (ValueError, ValidationError, json.JSONDecodeError) as exc:
            errors[param.name] = str(exc)

    extra = set(arguments.keys()) - {p.name for p in parameters}
    for key in extra:
        errors[key] = "unknown parameter"

    if errors:
        raise ParameterValidationError(errors)
    return validated
