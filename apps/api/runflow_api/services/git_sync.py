"""Git sync wrappers for the API service."""

from __future__ import annotations

from pathlib import Path

from runflow_api.config import get_settings
from runflow_shared.git_sync import (
    apply_overlay_files,
    get_git_worktree as _get_git_worktree,
    sync_git_to_dir,
)


def get_git_worktree(git_config: dict) -> Path:
    return _get_git_worktree(git_config, data_dir=Path(get_settings().data_dir))


def sync_git_job(git_config: dict, workspace_job_dir: Path) -> Path:
    return sync_git_to_dir(git_config, workspace_job_dir, data_dir=Path(get_settings().data_dir))
