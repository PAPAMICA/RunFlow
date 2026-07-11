"""Git repository sync — shared between API (preview) and worker (execution)."""

from __future__ import annotations

import hashlib
import logging
import os
import shutil
import subprocess
from collections.abc import Callable
from pathlib import Path
from urllib.parse import quote, urlparse, urlunparse

logger = logging.getLogger(__name__)

SystemLogFn = Callable[[str], None] | None

GIT_MISSING_MSG = "Git n'est pas installé — installez git dans le conteneur"
AUTH_REQUIRED_HINT = (
    "Authentification Git requise pour ce dépôt. "
    "Ajoutez un Personal Access Token (GitHub) ou sélectionnez un credential."
)


def default_git_username(host: str) -> str:
    host = host.lower()
    if "github.com" in host:
        return "x-access-token"
    if "gitlab" in host:
        return "oauth2"
    if "bitbucket.org" in host:
        return "x-token-auth"
    return "git"


def _repo_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def _normalize_repository_url(url: str) -> str:
    cleaned = url.strip()
    if cleaned.startswith("git@"):
        raise RuntimeError(
            "Les URLs SSH (git@...) ne sont pas supportées. "
            "Utilisez une URL HTTPS avec token ou credential."
        )
    parsed = urlparse(cleaned)
    if parsed.username or parsed.password:
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


def _run_git(args: list[str], *, cwd: Path | None = None, timeout: int = 600) -> None:
    env = {**os.environ, "GIT_TERMINAL_PROMPT": "0"}
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=cwd,
            check=True,
            capture_output=True,
            text=True,
            env=env,
            timeout=timeout,
        )
        if result.stderr:
            logger.debug("git %s: %s", " ".join(args[:3]), result.stderr.strip())
    except FileNotFoundError as exc:
        raise RuntimeError(GIT_MISSING_MSG) from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"Timeout Git après {timeout}s : {' '.join(args[:4])}") from exc
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        stdout = (exc.stdout or "").strip()
        detail = stderr or stdout or "Commande Git échouée"
        raise RuntimeError(detail) from exc


def ensure_git_ready() -> None:
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


def resolve_entrypoint(entrypoint: str, git_subpath: str = "") -> str:
    """Normalize entrypoint path relative to the synced git root (subpath or repo root)."""
    ep = entrypoint.strip().replace("\\", "/").lstrip("/")
    sub = (git_subpath or "").strip().replace("\\", "/").strip("/")
    if not sub:
        return ep
    prefix = f"{sub}/"
    if ep.startswith(prefix):
        return ep[len(prefix) :]
    return ep


def discover_entrypoint(
    workspace: Path,
    entrypoint: str,
    git_subpath: str = "",
    *,
    configured: str | None = None,
) -> str:
    """Find an existing script path under workspace for the configured entrypoint."""
    ep = entrypoint.strip().replace("\\", "/").lstrip("/")
    sub = (git_subpath or "").strip().replace("\\", "/").strip("/")
    configured = configured or ep

    candidates: list[str] = []
    for value in (
        resolve_entrypoint(ep, sub),
        ep,
        Path(ep).name,
    ):
        if value and value not in candidates:
            candidates.append(value)

    for cand in candidates:
        if (workspace / cand).is_file():
            return cand

    basename = Path(ep).name
    if basename:
        matches = sorted(
            p.relative_to(workspace).as_posix()
            for p in workspace.rglob(basename)
            if p.is_file()
        )
        if len(matches) == 1:
            return matches[0]
        if matches:
            for preferred in (ep, f"{sub}/{basename}" if sub else "", basename):
                if preferred and preferred in matches:
                    return preferred
            for match in matches:
                if match.endswith(ep) or ep.endswith(match):
                    return match
            return matches[0]

    scripts = _list_workspace_scripts(workspace)
    hint = f" Scripts trouvés : {', '.join(scripts)}." if scripts else " Aucun script .py/.sh dans le workspace."
    raise FileNotFoundError(
        f"Entrypoint introuvable : « {ep} » (configuré : « {configured} »).{hint}"
    )


def _list_workspace_scripts(root: Path, *, limit: int = 12) -> list[str]:
    if not root.is_dir():
        return []
    found: list[str] = []
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.suffix in {".py", ".sh", ".bash"}:
            found.append(path.relative_to(root).as_posix())
            if len(found) >= limit:
                break
    return found


def validate_job_entrypoint(workspace: Path, resolved: str, *, configured: str) -> None:
    target = workspace / resolved
    if target.is_file():
        return
    scripts = _list_workspace_scripts(workspace)
    hint = f" Scripts trouvés : {', '.join(scripts)}." if scripts else " Aucun script .py/.sh dans le workspace."
    raise FileNotFoundError(
        f"Entrypoint introuvable : « {resolved} » (configuré : « {configured} »).{hint}"
    )


def validate_or_discover_entrypoint(
    workspace: Path,
    entrypoint: str,
    git_subpath: str = "",
) -> str:
    """Validate entrypoint exists, auto-discovering workspace-relative path if needed."""
    return discover_entrypoint(workspace, entrypoint, git_subpath, configured=entrypoint)


def get_git_worktree(
    git_config: dict,
    *,
    data_dir: Path,
    on_log: SystemLogFn = None,
) -> Path:
    """Fetch git repo and return the effective source directory (cached)."""

    def emit(message: str) -> None:
        logger.info(message)
        if on_log:
            on_log(message)

    ensure_git_ready()
    url = git_config["repository_url"]
    branch = git_config.get("branch") or "main"
    subpath = git_config.get("path", "")
    access_token = git_config.get("access_token")
    username = git_config.get("username")

    canonical_url = _normalize_repository_url(url)
    had_auth = bool(access_token and str(access_token).strip())
    clone_url = _auth_repository_url(canonical_url, access_token, username)

    emit(f"Clone Git : {canonical_url}")
    emit(f"Branche : {branch}")
    if subpath:
        emit(f"Sous-dossier : {subpath}")

    cache_dir = data_dir / "git-cache" / _repo_hash(canonical_url)
    cache_dir.parent.mkdir(parents=True, exist_ok=True)

    if (cache_dir / ".git").exists():
        emit("Mise à jour du dépôt (git fetch)…")
        try:
            _update_repo(clone_url, branch, cache_dir, had_auth=had_auth)
            emit("Dépôt mis à jour")
        except RuntimeError:
            logger.warning("git cache refresh failed, recloning %s", canonical_url)
            emit("Échec du fetch — reclonage complet…")
            _clone_repo(clone_url, branch, cache_dir, had_auth=had_auth)
            emit("Clone Git terminé")
    else:
        emit("Clone initial du dépôt…")
        if cache_dir.exists():
            shutil.rmtree(cache_dir)
        _clone_repo(clone_url, branch, cache_dir, had_auth=had_auth)
        emit("Clone Git terminé")

    src = cache_dir / subpath if subpath else cache_dir
    if not src.is_dir():
        raise RuntimeError(f"Sous-dossier introuvable dans le dépôt : {subpath or '.'}")
    return src


def sync_git_to_dir(
    git_config: dict,
    target_dir: Path,
    *,
    data_dir: Path,
    on_log: SystemLogFn = None,
) -> Path:
    """Clone/fetch git repo and copy sources into target_dir."""

    def emit(message: str) -> None:
        logger.info(message)
        if on_log:
            on_log(message)

    src = get_git_worktree(git_config, data_dir=data_dir, on_log=on_log)
    emit("Copie des sources vers le workspace…")
    if target_dir.exists():
        shutil.rmtree(target_dir)
    shutil.copytree(src, target_dir)
    file_count = sum(1 for p in target_dir.rglob("*") if p.is_file())
    emit(f"Workspace prêt ({file_count} fichier(s))")
    return target_dir


def apply_overlay_files(target_dir: Path, files: list[dict]) -> None:
    """Write overlay files (e.g. .env) onto a prepared job directory."""
    for item in files:
        rel_path = item.get("path", "").strip().lstrip("/")
        content = item.get("content")
        if not rel_path or content is None:
            continue
        if ".." in rel_path.split("/"):
            raise ValueError(f"Chemin de fichier invalide : {rel_path}")
        dest = target_dir / rel_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8")


def write_internal_files(target_dir: Path, files: list[dict]) -> None:
    """Materialize internal job files from API payload."""
    target_dir.mkdir(parents=True, exist_ok=True)
    for item in files:
        rel_path = item.get("path", "").strip().lstrip("/")
        if not rel_path:
            continue
        if ".." in rel_path.split("/"):
            raise ValueError(f"Chemin de fichier invalide : {rel_path}")
        dest = target_dir / rel_path
        if item.get("is_directory"):
            dest.mkdir(parents=True, exist_ok=True)
        elif item.get("content") is not None:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(item["content"], encoding="utf-8")
