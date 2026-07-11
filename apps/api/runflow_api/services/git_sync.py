"""Git repository sync for Git-sourced jobs."""

from __future__ import annotations

import hashlib
import logging
import shutil
import subprocess
from pathlib import Path

from runflow_api.config import get_settings

logger = logging.getLogger(__name__)

GIT_MISSING_MSG = "Git n'est pas installé dans le conteneur API (rebuild requis)"


def _repo_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def _run_git(args: list[str], *, cwd: Path | None = None) -> None:
    try:
        subprocess.run(
            ["git", *args],
            cwd=cwd,
            check=True,
            capture_output=True,
        )
    except FileNotFoundError as exc:
        raise RuntimeError(GIT_MISSING_MSG) from exc
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or b"").decode(errors="replace").strip()
        stdout = (exc.stdout or b"").decode(errors="replace").strip()
        detail = stderr or stdout or "Commande Git échouée"
        raise RuntimeError(detail) from exc


def get_git_worktree(git_config: dict) -> Path:
    """Fetch git repo and return the effective source directory (cached)."""
    settings = get_settings()
    url = git_config["repository_url"]
    branch = git_config.get("branch", "main")
    subpath = git_config.get("path", "")

    cache_dir = Path(settings.data_dir) / "git-cache" / _repo_hash(url)
    cache_dir.mkdir(parents=True, exist_ok=True)

    if (cache_dir / ".git").exists():
        _run_git(["fetch", "origin"], cwd=cache_dir)
        _run_git(["checkout", branch], cwd=cache_dir)
        _run_git(["reset", "--hard", f"origin/{branch}"], cwd=cache_dir)
    else:
        _run_git(["clone", "--branch", branch, url, str(cache_dir)])

    src = cache_dir / subpath if subpath else cache_dir
    return src


def sync_git_job(git_config: dict, workspace_job_dir: Path) -> Path:
    """Fetch git repo and copy to isolated workspace. Returns job dir path."""
    src = get_git_worktree(git_config)
    if workspace_job_dir.exists():
        shutil.rmtree(workspace_job_dir)
    shutil.copytree(src, workspace_job_dir)
    return workspace_job_dir
