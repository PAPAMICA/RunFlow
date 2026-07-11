"""Git repository sync for Git-sourced jobs."""

from __future__ import annotations

import hashlib
import logging
import shutil
import subprocess
from pathlib import Path

from runflow_api.config import get_settings

logger = logging.getLogger(__name__)


def _repo_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def sync_git_job(git_config: dict, workspace_job_dir: Path) -> Path:
    """Fetch git repo and copy to isolated workspace. Returns job dir path."""
    settings = get_settings()
    url = git_config["repository_url"]
    branch = git_config.get("branch", "main")
    subpath = git_config.get("path", "")

    cache_dir = Path(settings.data_dir) / "git-cache" / _repo_hash(url)
    cache_dir.mkdir(parents=True, exist_ok=True)

    if (cache_dir / ".git").exists():
        subprocess.run(["git", "fetch", "origin"], cwd=cache_dir, check=True, capture_output=True)
        subprocess.run(["git", "checkout", branch], cwd=cache_dir, check=True, capture_output=True)
        subprocess.run(["git", "reset", "--hard", f"origin/{branch}"], cwd=cache_dir, check=True, capture_output=True)
    else:
        subprocess.run(["git", "clone", "--branch", branch, url, str(cache_dir)], check=True, capture_output=True)

    src = cache_dir / subpath if subpath else cache_dir
    if workspace_job_dir.exists():
        shutil.rmtree(workspace_job_dir)
    shutil.copytree(src, workspace_job_dir)
    return workspace_job_dir
