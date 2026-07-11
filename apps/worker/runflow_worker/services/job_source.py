"""Materialize job sources on the worker (no shared volume with API)."""

from __future__ import annotations

from pathlib import Path

from runflow_shared import SourceType
from runflow_shared.git_sync import apply_overlay_files, sync_git_to_dir, write_internal_files

from runflow_worker.config import get_settings


def materialize_job_workspace(job: dict, workspace_job: Path) -> None:
    """Prepare workspace/job from git clone or internal files sent in the claim payload."""
    settings = get_settings()
    data_dir = Path(settings.worker_data_dir)
    source_type = job.get("source_type", SourceType.INTERNAL)

    if workspace_job.exists():
        import shutil
        shutil.rmtree(workspace_job)

    if source_type == SourceType.GIT and job.get("git_config"):
        sync_git_to_dir(job["git_config"], workspace_job, data_dir=data_dir)
        apply_overlay_files(workspace_job, job.get("overlay_files") or [])
    else:
        write_internal_files(workspace_job, job.get("internal_files") or [])
