"""Structured result output for RunFlow jobs."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any


def _result_file() -> Path:
    path = os.environ.get("RUNFLOW_RESULT_FILE", "/runflow/output/result.json")
    return Path(path)


def set(data: Any) -> None:
    """Write structured result atomically to RUNFLOW_RESULT_FILE."""
    target = _result_file()
    target.parent.mkdir(parents=True, exist_ok=True)

    fd, tmp_path = tempfile.mkstemp(dir=target.parent, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, target)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise


def get() -> Any | None:
    """Read current result file if present."""
    target = _result_file()
    if not target.is_file():
        return None
    with open(target, encoding="utf-8") as f:
        return json.load(f)
