"""Sandboxed Jinja2 template engine."""

from __future__ import annotations

import json
from typing import Any

from jinja2 import BaseLoader, Environment, StrictUndefined, TemplateSyntaxError
from jinja2.sandbox import SandboxedEnvironment


def _make_env() -> SandboxedEnvironment:
    env = SandboxedEnvironment(loader=BaseLoader(), undefined=StrictUndefined, autoescape=False)
    return env


def render_template(template_str: str, context: dict[str, Any]) -> str:
    try:
        tmpl = _make_env().from_string(template_str)
        return tmpl.render(**context)
    except TemplateSyntaxError as exc:
        raise ValueError(f"Invalid template: {exc}") from exc


def render_argument_mapping(mapping: dict[str, str], context: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, tmpl_str in mapping.items():
        rendered = render_template(tmpl_str, context)
        try:
            result[key] = json.loads(rendered)
        except json.JSONDecodeError:
            result[key] = rendered
    return result
