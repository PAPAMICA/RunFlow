"""Tests for shared git sync helpers."""

import pytest

from runflow_shared.git_sync import (
    _auth_repository_url,
    _normalize_repository_url,
    default_git_username,
    discover_entrypoint,
    resolve_entrypoint,
    validate_job_entrypoint,
)
from pathlib import Path


def test_normalize_rejects_ssh():
    with pytest.raises(RuntimeError, match="SSH"):
        _normalize_repository_url("git@github.com:org/repo.git")


def test_default_username_github():
    assert default_git_username("github.com") == "x-access-token"


def test_auth_repository_url_github_pat():
    url = _auth_repository_url("https://github.com/org/repo.git", "ghp_secret")
    assert "x-access-token:ghp_secret@github.com" in url


def test_resolve_entrypoint_strips_git_subpath():
    assert resolve_entrypoint("helpers/sync_migrations.py", "helpers") == "sync_migrations.py"
    assert resolve_entrypoint("sync_migrations.py", "helpers") == "sync_migrations.py"
    assert resolve_entrypoint("helpers/sync_migrations.py", "") == "helpers/sync_migrations.py"


def test_validate_job_entrypoint(tmp_path: Path):
    script = tmp_path / "main.py"
    script.write_text("print('ok')")
    validate_job_entrypoint(tmp_path, "main.py", configured="main.py")


def test_validate_job_entrypoint_missing(tmp_path: Path):
    (tmp_path / "run.py").write_text("x = 1")
    with pytest.raises(FileNotFoundError, match="missing.py"):
        validate_job_entrypoint(tmp_path, "missing.py", configured="missing.py")


def test_discover_entrypoint_with_git_subpath(tmp_path: Path):
    (tmp_path / "sync_migrations.py").write_text("print('ok')")
    assert (
        discover_entrypoint(tmp_path, "helpers/sync_migrations.py", "helpers")
        == "sync_migrations.py"
    )


def test_discover_entrypoint_by_basename(tmp_path: Path):
    helpers = tmp_path / "helpers"
    helpers.mkdir()
    (helpers / "sync_migrations.py").write_text("print('ok')")
    assert discover_entrypoint(tmp_path, "helpers/sync_migrations.py", "") == "helpers/sync_migrations.py"


def test_discover_entrypoint_subpath_without_prefix(tmp_path: Path):
    (tmp_path / "sync_migrations.py").write_text("print('ok')")
    assert discover_entrypoint(tmp_path, "helpers/sync_migrations.py", "helpers") == "sync_migrations.py"

