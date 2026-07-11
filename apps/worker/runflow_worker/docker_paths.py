"""Resolve container paths to Docker host bind-mount paths."""

from __future__ import annotations

import logging
import re
import socket
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

_CONTAINER_ID_RE = re.compile(r"\b([0-9a-f]{64})\b")
_SHORT_ID_RE = re.compile(r"^[0-9a-f]{12,64}$")


@lru_cache
def self_container_id() -> str | None:
    """Best-effort detection of the current Docker container id (if any)."""
    # 1) Hostname defaults to the short container id unless overridden.
    hostname = socket.gethostname().strip()
    if _SHORT_ID_RE.match(hostname):
        return hostname

    # 2) cgroup v1/v2 references the full 64-char id.
    for proc_file in ("/proc/self/cgroup", "/proc/self/mountinfo"):
        try:
            with open(proc_file, encoding="utf-8") as fh:
                content = fh.read()
        except OSError:
            continue
        for marker in ("containers/", "docker/", "docker-", "/"):
            for match in _CONTAINER_ID_RE.finditer(content):
                candidate = match.group(1)
                if marker in content[max(0, match.start() - 40) : match.start()] or marker == "/":
                    return candidate

    # 3) Docker sets HOSTNAME env to the container id too.
    import os

    env_host = os.environ.get("HOSTNAME", "").strip()
    if _SHORT_ID_RE.match(env_host):
        return env_host

    return None


def _parse_bind_mounts() -> dict[str, str]:
    """Return {container_mount_point: host_source_path} for bind mounts."""
    mounts: dict[str, str] = {}
    try:
        with open("/proc/self/mountinfo", encoding="utf-8") as fh:
            for line in fh:
                if " - bind " not in line:
                    continue
                left, right = line.split(" - ", 1)
                left_fields = left.split()
                if len(left_fields) < 5:
                    continue
                mount_point = left_fields[4]
                right_fields = right.split()
                if len(right_fields) < 2 or right_fields[0] != "bind":
                    continue
                host_source = right_fields[1]
                mounts[mount_point] = host_source
    except OSError:
        logger.debug("mountinfo indisponible — pas de résolution automatique des chemins Docker")
    return mounts


@lru_cache
def _longest_bind_prefix(container_path: str) -> tuple[str, str] | None:
    mounts = _parse_bind_mounts()
    best: tuple[str, str] | None = None
    for mount_point, host_source in mounts.items():
        if container_path == mount_point or container_path.startswith(mount_point + "/"):
            if best is None or len(mount_point) > len(best[0]):
                best = (mount_point, host_source)
    return best


def resolve_docker_bind_path(
    container_path: str,
    *,
    worker_data_dir: str = "/worker-data",
    host_data_dir: str | None = None,
) -> str:
    """
    Translate a path inside the worker container to the host path Docker expects
    when creating sibling containers via /var/run/docker.sock.
    """
    path = str(Path(container_path))

    if host_data_dir:
        data_dir = str(Path(worker_data_dir))
        if path == data_dir or path.startswith(data_dir + "/"):
            suffix = path[len(data_dir) :]
            return str(Path(host_data_dir) / suffix.lstrip("/"))

    match = _longest_bind_prefix(path)
    if match:
        mount_point, host_source = match
        suffix = path[len(mount_point) :].lstrip("/")
        return str(Path(host_source) / suffix) if suffix else host_source

    logger.warning(
        "Chemin Docker non résolu (%s) — utilisation tel quel (peut échouer si worker conteneurisé)",
        path,
    )
    return path
