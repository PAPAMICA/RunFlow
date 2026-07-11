"""Extract job parameters from Python (argparse) and Bash scripts."""

from __future__ import annotations

import ast
import re
from typing import Any


def _normalize_flag(name: str) -> str:
    return name.lstrip("-").replace("-", "_")


def _infer_param_type(kwargs: dict[str, Any], action: str | None) -> str:
    if action in {"store_true", "store_false"}:
        return "flag"
    if kwargs.get("choices"):
        return "select"
    type_val = kwargs.get("type")
    if type_val is int or (isinstance(type_val, ast.Name) and type_val.id == "int"):
        return "integer"
    if type_val is float or (isinstance(type_val, ast.Name) and type_val.id == "float"):
        return "float"
    return "string"


def _literal_value(node: ast.expr | None) -> Any:
    if node is None:
        return None
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, (ast.List, ast.Tuple)):
        return [_literal_value(elt) for elt in node.elts]
    return None


def _parse_add_argument_call(call: ast.Call) -> dict[str, Any] | None:
    if not call.args:
        return None

    flags: list[str] = []
    for arg in call.args:
        if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
            flags.append(arg.value)

    kwargs: dict[str, Any] = {}
    action: str | None = None
    for kw in call.keywords:
        if kw.arg == "action" and isinstance(kw.value, ast.Constant):
            action = str(kw.value.value)
        elif kw.arg in {"dest", "default", "required", "choices", "help", "type", "nargs"}:
            if kw.arg == "type" and isinstance(kw.value, ast.Name):
                kwargs[kw.arg] = kw.value
            else:
                kwargs[kw.arg] = _literal_value(kw.value)

    long_flags = [f for f in flags if f.startswith("--")]
    short_flags = [f for f in flags if f.startswith("-") and not f.startswith("--")]
    positional = [f for f in flags if not f.startswith("-")]

    name: str | None = None
    if kwargs.get("dest"):
        name = str(kwargs["dest"])
    elif long_flags:
        name = _normalize_flag(long_flags[0])
    elif positional:
        name = positional[0]
    elif short_flags:
        name = _normalize_flag(short_flags[0])

    if not name:
        return None

    label = name.replace("_", " ").capitalize()
    if long_flags:
        label = long_flags[0]
    elif positional:
        label = positional[0]

    param_type = _infer_param_type(kwargs, action)
    options = kwargs.get("choices")
    if options and not isinstance(options, list):
        options = None

    required = bool(kwargs.get("required"))
    if positional and "required" not in kwargs:
        required = True
    if action == "store_true":
        required = False

    default_value = kwargs.get("default")
    if action == "store_false":
        default_value = False
    if action == "store_true" and default_value is None:
        default_value = False

    return {
        "name": name,
        "label": label,
        "description": kwargs.get("help"),
        "param_type": param_type,
        "required": required,
        "default_value": default_value,
        "options": options,
    }


def parse_python_script(source: str) -> list[dict[str, Any]]:
    """Parse argparse add_argument calls from Python source."""
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return _parse_python_script_regex(source)

    params: list[dict[str, Any]] = []
    seen: set[str] = set()

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if not (isinstance(func, ast.Attribute) and func.attr == "add_argument"):
            continue
        parsed = _parse_add_argument_call(node)
        if parsed and parsed["name"] not in seen:
            seen.add(parsed["name"])
            params.append(parsed)

    if not params:
        return _parse_python_script_regex(source)
    return params


def _parse_python_script_regex(source: str) -> list[dict[str, Any]]:
    params: list[dict[str, Any]] = []
    seen: set[str] = set()
    pattern = re.compile(
        r"add_argument\(\s*['\"](--)?([^'\"]+)['\"]"
        r"(?:\s*,\s*['\"]-['\"])?"
        r"(?:[^)]*required\s*=\s*(True|False))?"
        r"(?:[^)]*default\s*=\s*([^),\n]+))?",
        re.MULTILINE,
    )
    for match in pattern.finditer(source):
        is_long, raw = match.groups()[:2]
        name = _normalize_flag(raw) if is_long else raw
        if name in seen:
            continue
        seen.add(name)
        required = match.group(3) == "True" if match.group(3) else not is_long
        default_raw = match.group(4)
        default_value: Any = None
        if default_raw:
            default_value = default_raw.strip().strip("\"'")
        params.append({
            "name": name,
            "label": raw if is_long else name,
            "param_type": "string",
            "required": required,
            "default_value": default_value,
        })
    return params


def parse_bash_script(source: str) -> list[dict[str, Any]]:
    """Heuristic extraction of Bash script arguments."""
    params: list[dict[str, Any]] = []
    seen: set[str] = set()

    usage = re.search(r"#\s*Usage:\s*[^\n]*", source, re.IGNORECASE)
    if usage:
        for token in re.findall(r"<([^>]+)>|\[([^\]]+)\]", usage.group(0)):
            raw = (token[0] or token[1]).strip()
            name = re.sub(r"[^a-zA-Z0-9_]", "_", raw).lower().strip("_") or "arg"
            if name not in seen:
                seen.add(name)
                params.append({
                    "name": name,
                    "label": raw,
                    "param_type": "string",
                    "required": token[0] is not None,
                })

    for match in re.finditer(r'(\w+)="\$\{(\d+)(?::-([^}]*))?\}"', source):
        var_name, pos, default = match.groups()
        if var_name in seen:
            continue
        seen.add(var_name)
        params.append({
            "name": var_name,
            "label": var_name.replace("_", " ").capitalize(),
            "param_type": "string",
            "required": default is None,
            "default_value": default,
            "description": f"Argument positionnel ${pos}",
        })

    opts = re.search(r'getopts\s+["\']([^"\']+)["\']', source)
    if opts:
        flags = opts.group(1).replace(":", "")
        i = 0
        while i < len(flags):
            flag = flags[i]
            opt_name = f"opt_{flag}"
            if opt_name not in seen:
                seen.add(opt_name)
                requires_value = i + 1 < len(flags) and flags[i + 1] == ":"
                params.append({
                    "name": opt_name,
                    "label": f"-{flag}",
                    "param_type": "string",
                    "required": False,
                    "description": "Option getopts",
                })
            i += 1

    for match in re.finditer(r"\$([1-9])(?!\d)", source):
        idx = match.group(1)
        name = f"arg_{idx}"
        if name in seen:
            continue
        seen.add(name)
        params.append({
            "name": name,
            "label": f"Argument {idx}",
            "param_type": "string",
            "required": True,
            "description": f"Paramètre positionnel ${idx}",
        })

    return params


def parse_script_parameters(source: str, runner_type: str) -> list[dict[str, Any]]:
    if runner_type == "bash":
        return parse_bash_script(source)
    return parse_python_script(source)
