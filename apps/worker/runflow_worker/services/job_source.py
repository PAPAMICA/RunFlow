"""Materialize job sources on the worker (no shared volume with API)."""

from __future__ import annotations

import logging
import shutil
from pathlib import Path

from runflow_shared import SourceType
from runflow_shared.git_sync import apply_overlay_files, sync_git_to_dir, write_internal_files

from runflow_worker.config import get_settings

logger = logging.getLogger(__name__)


def materialize_job_workspace(job: dict, workspace_job: Path) -> None:
    """Prepare workspace/job from git clone or internal files sent in the claim payload."""
    settings = get_settings()
    data_dir = Path(settings.worker_data_dir)
    source_type = job.get("source_type", SourceType.INTERNAL)

    if workspace_job.exists():
        shutil.rmtree(workspace_job)

    if source_type == SourceType.GIT and job.get("git_config"):
        git_cfg = job["git_config"]
        logger.info(
            "Clone Git %s (branche=%s)",
            git_cfg.get("repository_url"),
            git_cfg.get("branch", "main"),
        )
        sync_git_to_dir(git_cfg, workspace_job, data_dir=data_dir)
        logger.info("Clone Git terminé → %s", workspace_job)
        overlay = job.get("overlay_files") or []
        if overlay:
            apply_overlay_files(workspace_job, overlay)
            logger.info("Overlay appliqué (%d fichier(s))", len(overlay))
    else:
        files = job.get("internal_files") or []
        logger.info("Écriture de %d fichier(s) internes", len(files))
        write_internal_files(workspace_job, files)
