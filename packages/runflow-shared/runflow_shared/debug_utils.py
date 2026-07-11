"""Debug helpers for verbose run logging."""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any


def redact_value(key: str, value: Any) -> Any:
    lowered = key.lower()
    if any(token in lowered for token in ("secret", "password", "token", "key", "credential")):
        return "***"
    if isinstance(value, str) and len(value) > 8 and any(c in value for c in ("@", "://")):
        return value[:3] + "***"
    return value


def format_redacted_dict(data: dict[str, Any]) -> str:
    redacted = {k: redact_value(k, v) for k, v in data.items()}
    return json.dumps(redacted, ensure_ascii=False, indent=2)


def format_directory_tree(
    root: Path,
    *,
    prefix: str = "",
    max_depth: int = 4,
    max_entries: int = 200,
    _depth: int = 0,
    _counter: list[int] | None = None,
) -> list[str]:
    """Return ASCII tree lines for a directory (depth- and count-limited)."""
    if _counter is None:
        _counter = [0]

    lines: list[str] = []
    if not root.exists():
        lines.append(f"{prefix}(inexistant)")
        return lines

    if root.is_file():
        size = root.stat().st_size
        lines.append(f"{prefix}{root.name} ({size} o)")
        return lines

    try:
        entries = sorted(root.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
    except OSError as exc:
        lines.append(f"{prefix}(erreur lecture: {exc})")
        return lines

    for index, entry in enumerate(entries):
        if _counter[0] >= max_entries:
            lines.append(f"{prefix}… ({max_entries} entrées max)")
            return lines

        is_last = index == len(entries) - 1
        branch = "└── " if is_last else "├── "
        child_prefix = prefix + ("    " if is_last else "│   ")

        if entry.is_dir():
            lines.append(f"{prefix}{branch}{entry.name}/")
            _counter[0] += 1
            if _depth < max_depth:
                lines.extend(
                    format_directory_tree(
                        entry,
                        prefix=child_prefix,
                        max_depth=max_depth,
                        max_entries=max_entries,
                        _depth=_depth + 1,
                        _counter=_counter,
                    )
                )
            elif any(entry.iterdir()):
                lines.append(f"{child_prefix}…")
        else:
            try:
                size = entry.stat().st_size
                lines.append(f"{prefix}{branch}{entry.name} ({size} o)")
            except OSError:
                lines.append(f"{prefix}{branch}{entry.name}")
            _counter[0] += 1

    return lines


def emit_debug_sections(
    on_log: Callable[[str], None],
    sections: list[tuple[str, list[str] | str]],
) -> None:
    for title, content in sections:
        on_log(f"── {title} ──")
        if isinstance(content, str):
            for line in content.splitlines() or ["(vide)"]:
                on_log(f"  {line}")
        else:
            for line in content or ["(vide)"]:
                on_log(f"  {line}")
