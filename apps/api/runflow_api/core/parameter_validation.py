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
        if param.default_value is None:
            return None
        # Coerce the default value through the same type logic (so a flag default
        # stored as the string "false" becomes the boolean False, etc.).
        raw = param.default_value

    if ptype == ParameterType.STRING:
        return str(raw)
    if ptype == ParameterType.INTEGER:
        return int(raw)
    if ptype == ParameterType.FLOAT:
        return float(raw)
    if ptype in (ParameterType.BOOLEAN, ParameterType.FLAG):
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


def apply_parameter_defaults(
    parameters: list[JobParameter],
    arguments: dict[str, Any] | None,
) -> dict[str, Any]:
    """Fill in missing enabled parameters with their (coerced) default value.

    Used for non-manual runs (triggers, schedules…) where arguments are built
    from a mapping and don't otherwise go through full validation. Existing keys
    and unknown/extra keys are preserved untouched.
    """
    result: dict[str, Any] = dict(arguments or {})
    for param in parameters:
        if getattr(param, "enabled", True) is False:
            continue
        if param.name in result:
            continue
        if param.default_value is None:
            continue
        try:
            result[param.name] = _coerce_value(param, None)
        except (ValueError, ValidationError, json.JSONDecodeError):
            continue
    return result


def validate_job_arguments(
    parameters: list[JobParameter],
    arguments: dict[str, Any] | None,
    *,
    forced_arguments: dict[str, Any] | None = None,
) -> dict[str, Any]:
    forced = forced_arguments or {}
    arguments = {**(arguments or {}), **forced}
    errors: dict[str, str] = {}
    validated: dict[str, Any] = {}

    # Disabled parameters are ignored entirely: not validated, not required and
    # any provided value is dropped. Only an explicit ``False`` disables a
    # parameter (a not-yet-persisted model may expose ``enabled`` as ``None``).
    active_params = [p for p in parameters if getattr(p, "enabled", True) is not False]
    disabled_names = {p.name for p in parameters if getattr(p, "enabled", True) is False}
    arguments = {k: v for k, v in arguments.items() if k not in disabled_names}

    for param in sorted(active_params, key=lambda p: p.position):
        raw = arguments.get(param.name)
        if raw is None and param.name not in arguments:
            raw = None
        try:
            validated[param.name] = _coerce_value(param, raw)
        except (ValueError, ValidationError, json.JSONDecodeError) as exc:
            errors[param.name] = str(exc)

    param_names = {p.name for p in active_params}
    extra = set(arguments.keys()) - param_names
    for key in extra:
        if key in forced:
            validated[key] = forced[key]
            continue
        errors[key] = "unknown parameter"

    if errors:
        raise ParameterValidationError(errors)
    return validated
