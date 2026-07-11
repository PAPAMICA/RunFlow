"""Result parsers for job output."""

from __future__ import annotations

import json
from typing import Any

from runflow_shared import ResultParser


class ResultParseError(Exception):
    pass


def parse_result(
    parser: str,
    stdout: str,
    stderr: str,
    exit_code: int,
    result_file_content: str | None = None,
) -> dict[str, Any] | None:
    if parser == ResultParser.NONE:
        return None

    if parser == ResultParser.RUNFLOW_SDK:
        if not result_file_content:
            return None
        try:
            data = json.loads(result_file_content)
            if not isinstance(data, (dict, list)):
                raise ResultParseError("SDK result must be JSON object or array")
            return data if isinstance(data, dict) else {"value": data}
        except json.JSONDecodeError as exc:
            raise ResultParseError(f"Invalid SDK result JSON: {exc}") from exc

    if parser == ResultParser.JSON_STDOUT:
        text = stdout.strip()
        if not text:
            return None
        try:
            data = json.loads(text)
            return data if isinstance(data, dict) else {"value": data}
        except json.JSONDecodeError as exc:
            raise ResultParseError(f"Invalid stdout JSON: {exc}") from exc

    if parser == ResultParser.LAST_JSON_LINE:
        for line in reversed(stdout.splitlines()):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                return data if isinstance(data, dict) else {"value": data}
            except json.JSONDecodeError:
                continue
        return None

    return None
