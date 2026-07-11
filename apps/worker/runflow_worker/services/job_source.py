"""Materialize job sources on the worker (no shared volume with API)."""

from __future__ import annotations

import logging
import shutil
from collections.abc import Callable
from pathlib import Path

from runflow_shared import SourceType
from runflow_shared.debug_utils import format_directory_tree
from runflow_shared.git_sync import (
    apply_overlay_files,
    discover_entrypoint,
    sync_git_to_dir,
    write_internal_files,
)

from runflow_worker.config import get_settings

logger = logging.getLogger(__name__)


def _emit(on_system_log: Callable[[str], None] | None, message: str) -> None:
    logger.info(message)
    if on_system_log:
        on_system_log(message)


def materialize_job_workspace(
    job: dict,
    workspace_job: Path,
    *,
    on_system_log: Callable[[str], None] | None = None,
    debug: bool = False,
) -> None:
    """Prepare workspace/job from git clone or internal files sent in the claim payload."""
    settings = get_settings()
    data_dir = Path(settings.worker_data_dir)
    source_type = job.get("source_type", SourceType.INTERNAL)

    if workspace_job.exists():
        shutil.rmtree(workspace_job)

    if source_type == SourceType.GIT and job.get("git_config"):
        git_cfg = job["git_config"]
        sync_git_to_dir(git_cfg, workspace_job, data_dir=data_dir, on_log=on_system_log)
        overlay = job.get("overlay_files") or []
        if overlay:
            apply_overlay_files(workspace_job, overlay)
            _emit(on_system_log, f"Overlay appliqué ({len(overlay)} fichier(s))")
        git_subpath = git_cfg.get("path", "")
    else:
        files = job.get("internal_files") or []
        _emit(on_system_log, f"Écriture de {len(files)} fichier(s) internes…")
        write_internal_files(workspace_job, files)
        _emit(on_system_log, "Fichiers internes prêts")
        git_subpath = ""

    entrypoint = job.get("entrypoint", "main.py")
    try:
        resolved = discover_entrypoint(workspace_job, entrypoint, git_subpath, configured=entrypoint)
    except FileNotFoundError as exc:
        raise RuntimeError(str(exc)) from exc
    job["resolved_entrypoint"] = resolved
    if resolved != entrypoint:
        _emit(on_system_log, f"Entrypoint ajusté : {entrypoint} → {resolved}")
    _emit(on_system_log, f"Entrypoint : {resolved}")

    if debug:
        _emit(on_system_log, "── Arborescence job/ (aperçu) ──")
        for line in format_directory_tree(workspace_job, max_depth=3, max_entries=80):
            _emit(on_system_log, f"  {line}")
