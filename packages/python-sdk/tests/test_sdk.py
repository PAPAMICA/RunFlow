"""RunFlow SDK tests."""

import json
import os
import tempfile
from pathlib import Path

from runflow.args import get_args
from runflow.result import get, set


def test_args_from_file():
    get_args.cache_clear()
    with tempfile.TemporaryDirectory() as tmp:
        args_file = Path(tmp) / "args.json"
        args_file.write_text(json.dumps({"domain": "example.com"}))
        os.environ["RUNFLOW_ARGS_FILE"] = str(args_file)
        result = get_args()
        assert result["domain"] == "example.com"
    get_args.cache_clear()


def test_result_atomic_write():
    with tempfile.TemporaryDirectory() as tmp:
        result_path = Path(tmp) / "result.json"
        os.environ["RUNFLOW_RESULT_FILE"] = str(result_path)
        set({"status": "online", "domain": "example.com"})
        data = get()
        assert data == {"status": "online", "domain": "example.com"}
