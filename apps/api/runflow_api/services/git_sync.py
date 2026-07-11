"""Git repository sync for Git-sourced jobs."""

from __future__ import annotations

import hashlib
import logging
import os
import shutil
import subprocess
from pathlib import Path
from urllib.parse import quote, urlparse, urlunparse

from runflow_api.config import get_settings
from runflow_api.services.git_auth import default_git_username, detect_git_host

logger = logging.getLogger(__name__)

GIT_MISSING_MSG = "Git n'est pas installé dans le conteneur API — relancez : docker compose up -d --build api"
AUTH_REQUIRED_HINT = (
    "Authentification Git requise pour ce dépôt. "
    "Ajoutez un Personal Access Token (GitHub) ou sélectionnez un credential."
)


def _repo_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def _normalize_repository_url(url: str) -> str:
    cleaned = url.strip()
    if cleaned.startswith("git@"):
        raise RuntimeError(
            "Les URLs SSH (git@...) ne sont pas supportées dans le conteneur. "
            "Utilisez une URL HTTPS avec token ou credential."
        )
    parsed = urlparse(cleaned)
    if parsed.username or parsed.password:
        # Strip embedded credentials from canonical URL used as cache key.
        host = parsed.hostname or ""
        port = f":{parsed.port}" if parsed.port else ""
        netloc = f"{host}{port}"
        cleaned = urlunparse(parsed._replace(netloc=netloc))
    return cleaned


def _auth_repository_url(
    url: str,
    access_token: str | None = None,
    username: str | None = None,
) -> str:
    """Inject HTTPS credentials without changing the canonical URL key."""
    normalized = _normalize_repository_url(url)
    if not access_token or not access_token.strip():
        return normalized

    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"}:
        return normalized

    host = parsed.hostname or ""
    if not host:
        return normalized

    git_user = username or default_git_username(host)
    token = quote(access_token.strip(), safe="")
    git_user_quoted = quote(git_user, safe="")
    port = f":{parsed.port}" if parsed.port else ""
    netloc = f"{git_user_quoted}:{token}@{host}{port}"
    return urlunparse(parsed._replace(netloc=netloc))


def _friendly_git_error(message: str, *, had_auth: bool) -> str:
    lower = message.lower()
    if "could not read username" in lower or "authentication failed" in lower or "403" in lower:
        if had_auth:
            return f"Authentification Git refusée. Vérifiez le token et ses droits « repo ».\n{message}"
        return f"{AUTH_REQUIRED_HINT}\n{message}"
    if "repository not found" in lower and not had_auth:
        return f"{AUTH_REQUIRED_HINT}\n{message}"
    return message


def _run_git(args: list[str], *, cwd: Path | None = None) -> None:
    env = {**os.environ, "GIT_TERMINAL_PROMPT": "0"}
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=cwd,
            check=True,
            capture_output=True,
            text=True,
            env=env,
        )
        if result.stderr:
            logger.debug("git %s: %s", " ".join(args[:3]), result.stderr.strip())
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
    _run_git(["config", "--global", "credential.helper", ""])


def _clone_repo(clone_url: str, branch: str, cache_dir: Path, *, had_auth: bool) -> None:
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
            last_error = RuntimeError(_friendly_git_error(str(exc), had_auth=had_auth))
            logger.warning("git clone strategy failed (%s): %s", args[1], exc)

    if last_error:
        raise last_error
    raise RuntimeError("Échec du clone Git")


def _update_repo(clone_url: str, branch: str, cache_dir: Path, *, had_auth: bool) -> None:
    try:
        _run_git(["remote", "set-url", "origin", clone_url], cwd=cache_dir)
        _run_git(["fetch", "origin", "--prune", "--depth", "1"], cwd=cache_dir)
        try:
            _run_git(["checkout", branch], cwd=cache_dir)
        except RuntimeError:
            _run_git(["checkout", "-B", branch, f"origin/{branch}"], cwd=cache_dir)
        _run_git(["reset", "--hard", f"origin/{branch}"], cwd=cache_dir)
    except RuntimeError as exc:
        raise RuntimeError(_friendly_git_error(str(exc), had_auth=had_auth)) from exc


def get_git_worktree(git_config: dict) -> Path:
    """Fetch git repo and return the effective source directory (cached)."""
    ensure_git_ready()
    settings = get_settings()
    url = git_config["repository_url"]
    branch = git_config.get("branch") or "main"
    subpath = git_config.get("path", "")
    access_token = git_config.get("access_token")
    username = git_config.get("username")

    canonical_url = _normalize_repository_url(url)
    had_auth = bool(access_token and str(access_token).strip())
    clone_url = _auth_repository_url(canonical_url, access_token, username)

    if clone_url == canonical_url and detect_git_host(canonical_url):
        logger.debug("git clone without credentials for %s", detect_git_host(canonical_url))

    cache_dir = Path(settings.data_dir) / "git-cache" / _repo_hash(canonical_url)
    cache_dir.parent.mkdir(parents=True, exist_ok=True)

    if (cache_dir / ".git").exists():
        try:
            _update_repo(clone_url, branch, cache_dir, had_auth=had_auth)
        except RuntimeError:
            logger.warning("git cache refresh failed, recloning %s", canonical_url)
            _clone_repo(clone_url, branch, cache_dir, had_auth=had_auth)
    else:
        if cache_dir.exists():
            shutil.rmtree(cache_dir)
        _clone_repo(clone_url, branch, cache_dir, had_auth=had_auth)

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
