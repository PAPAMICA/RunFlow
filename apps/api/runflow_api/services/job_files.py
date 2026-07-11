"""Job file storage on disk with path traversal protection."""

from __future__ import annotations

import os
from pathlib import Path

from runflow_api.config import get_settings
from runflow_api.utils import safe_join


class JobFileStorage:
    def __init__(self, jobs_dir: str | None = None):
        settings = get_settings()
        self.jobs_dir = Path(jobs_dir or settings.jobs_dir)

    def job_root(self, job_id: str) -> Path:
        return safe_join(self.jobs_dir, job_id)

    def ensure_job_root(self, job_id: str) -> Path:
        root = self.job_root(job_id)
        root.mkdir(parents=True, exist_ok=True)
        return root

    def resolve_path(self, job_id: str, relative_path: str) -> Path:
        relative_path = relative_path.strip("/")
        if not relative_path:
            return self.job_root(job_id)
        return safe_join(self.job_root(job_id), *relative_path.split("/"))

    def write_file(self, job_id: str, relative_path: str, content: str) -> Path:
        path = self.resolve_path(job_id, relative_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def read_file(self, job_id: str, relative_path: str) -> str:
        path = self.resolve_path(job_id, relative_path)
        return path.read_text(encoding="utf-8")

    def delete_path(self, job_id: str, relative_path: str) -> None:
        path = self.resolve_path(job_id, relative_path)
        if path.is_dir():
            for child in sorted(path.rglob("*"), reverse=True):
                if child.is_file():
                    child.unlink()
                elif child.is_dir():
                    child.rmdir()
            path.rmdir()
        elif path.is_file():
            path.unlink()

    def rename_path(self, job_id: str, old_path: str, new_path: str) -> None:
        src = self.resolve_path(job_id, old_path)
        dst = self.resolve_path(job_id, new_path)
        dst.parent.mkdir(parents=True, exist_ok=True)
        os.rename(src, dst)

    def list_tree(self, job_id: str) -> list[dict]:
        root = self.job_root(job_id)
        if not root.exists():
            return []
        items: list[dict] = []

        def walk(current: Path, rel: str = "") -> None:
            for entry in sorted(current.iterdir()):
                rel_path = f"{rel}/{entry.name}" if rel else entry.name
                if entry.is_dir():
                    items.append({"path": rel_path, "is_directory": True})
                    walk(entry, rel_path)
                else:
                    items.append({"path": rel_path, "is_directory": False})

        walk(root)
        return items

    def sync_to_disk(self, job_id: str, files: list) -> None:
        """Write all job files from DB metadata to disk."""
        root = self.ensure_job_root(job_id)
        for f in files:
            if f.is_directory:
                self.resolve_path(job_id, f.path).mkdir(parents=True, exist_ok=True)
            elif f.content is not None:
                self.write_file(job_id, f.path, f.content)

    def sync_overlay_to(self, job_id: str, files: list, target_dir: Path) -> None:
        """Overlay DB-managed files (e.g. .env) onto a git-synced workspace."""
        for f in files:
            if f.is_directory or f.content is None:
                continue
            dest = safe_join(target_dir, *f.path.strip("/").split("/"))
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(f.content, encoding="utf-8")
