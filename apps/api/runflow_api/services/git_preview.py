"""Git repository preview for job creation."""

from __future__ import annotations

from pathlib import Path

from runflow_api.services.git_sync import get_git_worktree
from runflow_api.services.script_parser import parse_script_parameters

ENV_CANDIDATES = (".env.example", ".env.sample", ".env.template", "env.example")
SCRIPT_EXTENSIONS = {".py", ".sh", ".bash"}
SKIP_DIRS = {".git", "__pycache__", "node_modules", ".venv", "venv", "dist", "build"}


def _list_files(root: Path, prefix: str = "", depth: int = 0, max_depth: int = 4) -> list[dict]:
    if depth > max_depth or not root.is_dir():
        return []
    entries: list[dict] = []
    try:
        children = sorted(root.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
    except OSError:
        return []

    for child in children:
        if child.name in SKIP_DIRS:
            continue
        rel = f"{prefix}/{child.name}" if prefix else child.name
        if child.is_dir():
            entries.append({"path": rel, "is_directory": True})
            entries.extend(_list_files(child, rel, depth + 1, max_depth))
        else:
            entries.append({"path": rel, "is_directory": False})
    return entries


def _find_env_example(root: Path) -> tuple[str | None, str | None]:
    for name in ENV_CANDIDATES:
        candidate = root / name
        if candidate.is_file():
            try:
                return name, candidate.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
    return None, None


def _suggest_entrypoints(root: Path, runner_type: str) -> list[str]:
    exts = {".sh", ".bash"} if runner_type == "bash" else {".py"}
    if runner_type == "ansible":
        exts = {".yml", ".yaml"}
    found: list[str] = []

    def walk(path: Path, depth: int) -> None:
        if depth > 2:
            return
        try:
            items = sorted(path.iterdir(), key=lambda p: p.name.lower())
        except OSError:
            return
        for item in items:
            if item.name in SKIP_DIRS:
                continue
            if item.is_dir():
                walk(item, depth + 1)
            elif item.suffix in exts:
                rel = item.relative_to(root).as_posix()
                found.append(rel)

    walk(root, 0)
    priority = ("main.py", "run.py", "app.py", "main.sh", "run.sh", "playbook.yml")
    found.sort(key=lambda p: (priority.index(p) if p in priority else 99, p))
    return found[:30]


def build_git_preview(
    git_config: dict,
    runner_type: str = "python",
    entrypoint: str | None = None,
) -> dict:
    """Clone/fetch repo and return preview metadata for the job creation UI."""
    try:
        root = get_git_worktree(git_config)
    except RuntimeError as exc:
        raise ValueError(str(exc)) from exc

    if not root.is_dir():
        raise ValueError("Le dépôt Git ou le sous-dossier configuré est introuvable")

    env_path, env_content = _find_env_example(root)
    files = _list_files(root)
    suggested = _suggest_entrypoints(root, runner_type)

    resolved_entrypoint = entrypoint or (suggested[0] if suggested else None)
    detected: list[dict] = []
    if resolved_entrypoint:
        script_path = root / resolved_entrypoint
        if script_path.is_file():
            try:
                source = script_path.read_text(encoding="utf-8", errors="replace")
                detected = parse_script_parameters(source, runner_type)
                for i, p in enumerate(detected):
                    p["position"] = i
            except OSError:
                pass

    return {
        "root_path": str(root),
        "files": files,
        "env_example_path": env_path,
        "env_example_content": env_content,
        "suggested_entrypoints": suggested,
        "detected_parameters": detected,
        "entrypoint": resolved_entrypoint,
    }
