"""Git repository sync for Git-sourced jobs."""

from __future__ import annotations

import hashlib
import logging
import shutil
import subprocess
from pathlib import Path
from urllib.parse import quote, urlparse, urlunparse

from runflow_api.config import get_settings

logger = logging.getLogger(__name__)

GIT_MISSING_MSG = "Git n'est pas installé dans le conteneur API — relancez : docker compose up -d --build api"


def _repo_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def _normalize_repository_url(url: str) -> str:
    cleaned = url.strip()
    if cleaned.startswith("git@"):
        raise RuntimeError(
            "Les URLs SSH (git@...) ne sont pas supportées dans le conteneur. "
            "Utilisez une URL HTTPS (éventuellement avec token)."
        )
    return cleaned


def _auth_repository_url(url: str, access_token: str | None = None) -> str:
    """Inject HTTPS credentials without changing the canonical URL key."""
    normalized = _normalize_repository_url(url)
    if not access_token or not access_token.strip():
        return normalized

    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"}:
        return normalized

    token = quote(access_token.strip(), safe="")
    username = quote(parsed.username or "oauth2", safe="")
    host = parsed.hostname or ""
    if not host:
        return normalized

    port = f":{parsed.port}" if parsed.port else ""
    netloc = f"{username}:{token}@{host}{port}"
    return urlunparse(parsed._replace(netloc=netloc))


def _run_git(args: list[str], *, cwd: Path | None = None) -> None:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=cwd,
            check=True,
            capture_output=True,
            text=True,
        )
        if result.stderr:
            logger.debug("git %s: %s", " ".join(args), result.stderr.strip())
    except FileNotFoundError as exc:
        raise RuntimeError(GIT_MISSING_MSG) from exc
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        stdout = (exc.stdout or "").strip()
        detail = stderr or stdout or "Commande Git échouée"
        raise RuntimeError(detail) from exc


def ensure_git_ready() -> None:
    """Configure git for container usage (idempotent)."""
    _run_git(["config", "--global", "--add", "safe.directory", "*"])


def _clone_repo(clone_url: str, branch: str, cache_dir: Path) -> None:
    if cache_dir.exists():
        shutil.rmtree(cache_dir)

    strategies = [
        ["clone", "--depth", "1", "--single-branch", "--branch", branch, clone_url, str(cache_dir)],
        ["clone", "--depth", "1", clone_url, str(cache_dir)],
        ["clone", clone_url, str(cache_dir)],
    ]

    last_error: RuntimeError | None = None
    for args in strategies:
        if cache_dir.exists():
            shutil.rmtree(cache_dir)
        try:
            _run_git(args)
            if "branch" not in args:
                _run_git(["checkout", branch], cwd=cache_dir)
            return
        except RuntimeError as exc:
            last_error = exc
            logger.warning("git clone strategy failed (%s): %s", args[1], exc)

    if last_error:
        raise last_error
    raise RuntimeError("Échec du clone Git")


def _update_repo(clone_url: str, branch: str, cache_dir: Path) -> None:
    _run_git(["remote", "set-url", "origin", clone_url], cwd=cache_dir)
    _run_git(["fetch", "origin", "--prune", "--depth", "1"], cwd=cache_dir)
    try:
        _run_git(["checkout", branch], cwd=cache_dir)
    except RuntimeError:
        _run_git(["checkout", "-B", branch, f"origin/{branch}"], cwd=cache_dir)
    _run_git(["reset", "--hard", f"origin/{branch}"], cwd=cache_dir)


def get_git_worktree(git_config: dict) -> Path:
    """Fetch git repo and return the effective source directory (cached)."""
    ensure_git_ready()
    settings = get_settings()
    url = git_config["repository_url"]
    branch = git_config.get("branch") or "main"
    subpath = git_config.get("path", "")
    access_token = git_config.get("access_token")

    canonical_url = _normalize_repository_url(url)
    clone_url = _auth_repository_url(canonical_url, access_token)

    cache_dir = Path(settings.data_dir) / "git-cache" / _repo_hash(canonical_url)
    cache_dir.parent.mkdir(parents=True, exist_ok=True)

    if (cache_dir / ".git").exists():
        try:
            _update_repo(clone_url, branch, cache_dir)
        except RuntimeError:
            logger.warning("git cache refresh failed, recloning %s", canonical_url)
            _clone_repo(clone_url, branch, cache_dir)
    else:
        if cache_dir.exists():
            shutil.rmtree(cache_dir)
        _clone_repo(clone_url, branch, cache_dir)

    src = cache_dir / subpath if subpath else cache_dir
    if not src.is_dir():
        raise RuntimeError(f"Sous-dossier introuvable dans le dépôt : {subpath or '.'}")
    return src


def sync_git_job(git_config: dict, workspace_job_dir: Path) -> Path:
    """Fetch git repo and copy to isolated workspace. Returns job dir path."""
    src = get_git_worktree(git_config)
    if workspace_job_dir.exists():
        shutil.rmtree(workspace_job_dir)
    shutil.copytree(src, workspace_job_dir)
    return workspace_job_dir
