"""Tests for Docker bind path resolution."""

from runflow_worker.docker_paths import resolve_docker_bind_path


def test_resolve_with_explicit_host_data_dir():
    result = resolve_docker_bind_path(
        "/worker-data/runs/abc123/job",
        worker_data_dir="/worker-data",
        host_data_dir="/host/runflow/worker-skynet",
    )
    assert result == "/host/runflow/worker-skynet/runs/abc123/job"


def test_resolve_without_mapping_returns_input(monkeypatch):
    monkeypatch.setattr(
        "runflow_worker.docker_paths._parse_bind_mounts",
        lambda: {},
    )
    result = resolve_docker_bind_path("/worker-data/runs/xyz")
    assert result == "/worker-data/runs/xyz"
