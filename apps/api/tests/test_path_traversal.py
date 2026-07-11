"""Tests for path traversal protection."""

import tempfile
from pathlib import Path

import pytest

from runflow_api.services.job_files import JobFileStorage
from runflow_api.utils import safe_join


def test_safe_join_blocks_traversal():
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp)
        with pytest.raises(ValueError, match="traversal"):
            safe_join(base, "..", "etc", "passwd")


def test_job_file_storage_write_read():
    with tempfile.TemporaryDirectory() as tmp:
        storage = JobFileStorage(jobs_dir=tmp)
        storage.write_file("job1", "main.py", "print('hello')")
        content = storage.read_file("job1", "main.py")
        assert content == "print('hello')"


def test_job_file_storage_traversal():
    with tempfile.TemporaryDirectory() as tmp:
        storage = JobFileStorage(jobs_dir=tmp)
        with pytest.raises(ValueError):
            storage.write_file("job1", "../../etc/passwd", "hack")
