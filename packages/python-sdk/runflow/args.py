"""Access job arguments from environment or args file."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any


@lru_cache(maxsize=1)
def get_args() -> dict[str, Any]:
    """Load job arguments from RUNFLOW_ARGS_FILE or RUNFLOW_ARG_* env vars."""
    args_file = os.environ.get("RUNFLOW_ARGS_FILE")
    if args_file and os.path.isfile(args_file):
        with open(args_file, encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                return data

    result: dict[str, Any] = {}
    prefix = "RUNFLOW_ARG_"
    for key, value in os.environ.items():
        if key.startswith(prefix):
            name = key[len(prefix) :].lower()
            result[name] = value
    return result


class ArgsProxy:
    """Dict-like proxy for job arguments."""

    def __getitem__(self, key: str) -> Any:
        return get_args()[key]

    def get(self, key: str, default: Any = None) -> Any:
        return get_args().get(key, default)

    def __contains__(self, key: str) -> bool:
        return key in get_args()

    def keys(self):
        return get_args().keys()

    def items(self):
        return get_args().items()

    def __repr__(self) -> str:
        return repr(get_args())
