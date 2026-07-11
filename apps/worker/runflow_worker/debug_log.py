"""Emit verbose debug information during job execution."""

from __future__ import annotations

import json
import shlex
from collections.abc import Callable
from pathlib import Path

from runflow_shared.debug_utils import (
    emit_debug_sections,
    format_directory_tree,
    format_redacted_dict,
)


def _emit(on_log: Callable[[str], None] | None, message: str) -> None:
    if on_log:
        on_log(message)


def emit_workspace_debug(
    workspace: Path,
    job: dict[str, Any],
    arguments: dict[str, Any],
    *,
    on_log: Callable[[str], None] | None,
) -> None:
    job_dir = workspace / "job"
    input_dir = workspace / "input"
    output_dir = workspace / "output"

    git_cfg = job.get("git_config") or {}
    repo_url = git_cfg.get("repository_url", "")
    if "@" in repo_url and "://" in repo_url:
        scheme, rest = repo_url.split("://", 1)
        if "@" in rest:
            repo_url = f"{scheme}://***@{rest.split('@', 1)[1]}"

    resolved = job.get("resolved_entrypoint") or job.get("entrypoint", "main.py")
    entry_path = job_dir / resolved

    checks: list[str] = []
    for label, path in (
        ("entrypoint", entry_path),
        (".env", job_dir / ".env"),
        ("requirements.txt", job_dir / "requirements.txt"),
        ("args.json", input_dir / "args.json"),
    ):
        if path.is_file():
            checks.append(f"{label}: présent ({path.stat().st_size} o)")
        else:
            checks.append(f"{label}: absent ({path})")

    sections: list[tuple[str, list[str] | str]] = [
        ("Configuration job", [
            f"slug: {job.get('slug')}",
            f"runner: {job.get('runner_type')}",
            f"source: {job.get('source_type')}",
            f"entrypoint configuré: {job.get('entrypoint')}",
            f"entrypoint résolu: {resolved}",
            f"timeout: {job.get('timeout_seconds', 300)}s",
            f"network: {job.get('network_mode', 'bridge')}",
            f"memory: {job.get('memory_limit_mb', 512)} Mo",
            f"cpu: {job.get('cpu_limit', 1.0)}",
        ]),
        ("Source Git", [
            f"url: {repo_url or '(n/a)'}",
            f"branche: {git_cfg.get('branch', 'main')}",
            f"subpath: {git_cfg.get('path') or '(racine)'}",
            f"overlay: {len(job.get('overlay_files') or [])} fichier(s)",
        ] if job.get("source_type") == "git" else [
            f"fichiers internes: {len(job.get('internal_files') or [])}",
        ]),
        ("Arguments", format_redacted_dict(arguments)),
        ("Vérifications fichiers", checks),
        (f"Arborescence {job_dir.name}/", format_directory_tree(job_dir)),
    ]

    if input_dir.is_dir():
        sections.append((f"Arborescence {input_dir.name}/", format_directory_tree(input_dir, max_depth=2)))

    emit_debug_sections(on_log or (lambda _m: None), sections)


def emit_runner_debug(
    *,
    runner_type: str,
    image: str,
    command: list[str],
    volumes: dict[str, dict[str, str]],
    env: dict[str, str],
    secret_keys: set[str],
    on_log: Callable[[str], None] | None,
) -> None:
    cmd_display = " ".join(shlex.quote(part) for part in command)
    if len(cmd_display) > 500:
        cmd_display = cmd_display[:500] + "…"

    runflow_env = {k: v for k, v in env.items() if k.startswith("RUNFLOW_")}
    other_env = {
        k: ("***" if k in secret_keys else v)
        for k, v in env.items()
        if not k.startswith("RUNFLOW_")
    }

    volume_lines = [
        f"{host} → {mount['bind']} ({mount.get('mode', 'rw')})"
        for host, mount in volumes.items()
    ]

    sections: list[tuple[str, list[str] | str]] = [
        ("Runner Docker", [
            f"image: {image}",
            f"type: {runner_type}",
            f"commande: {cmd_display}",
        ]),
        ("Volumes", volume_lines),
        ("Variables RUNFLOW_*", format_redacted_dict(runflow_env)),
    ]
    if other_env:
        sections.append(("Autres variables d'environnement", format_redacted_dict(other_env)))

    emit_debug_sections(on_log or (lambda _m: None), sections)


def emit_post_run_debug(
    workspace: Path,
    exit_code: int,
    stdout: str,
    stderr: str,
    *,
    on_log: Callable[[str], None] | None,
) -> None:
    result_file = workspace / "output" / "result.json"
    sections: list[tuple[str, list[str] | str]] = [
        ("Résultat", [f"exit_code: {exit_code}"]),
    ]

    if stdout.strip():
        lines = stdout.strip().splitlines()
        sections.append(("Stdout (extrait)", lines[-30:] if len(lines) > 30 else lines))

    if stderr.strip():
        lines = stderr.strip().splitlines()
        sections.append(("Stderr", lines[-30:] if len(lines) > 30 else lines))
    elif exit_code != 0:
        sections.append(("Stderr", ["(aucune sortie stderr capturée)"]))

    if result_file.is_file():
        try:
            content = result_file.read_text(encoding="utf-8")
            parsed = json.loads(content)
            sections.append(("result.json", format_redacted_dict(parsed) if isinstance(parsed, dict) else content))
        except (json.JSONDecodeError, OSError) as exc:
            sections.append(("result.json", [f"erreur lecture: {exc}"]))

    output_dir = workspace / "output"
    if output_dir.is_dir() and any(output_dir.iterdir()):
        sections.append(("Arborescence output/", format_directory_tree(output_dir, max_depth=2)))

    _emit(on_log, "── Fin debug ──")
    emit_debug_sections(on_log or (lambda _m: None), sections)
