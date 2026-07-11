"""Tests for git-sourced jobs and env overlay."""

from runflow_api.services.job_files import JobFileStorage


def test_sync_overlay_writes_env(tmp_path):
    storage = JobFileStorage(jobs_dir=str(tmp_path / "jobs"))
    job_id = "01JOBTEST0000001"
    target = tmp_path / "workspace"
    target.mkdir()

    class FakeFile:
        path = ".env"
        is_directory = False
        content = "API_KEY=secret\nFOO=bar\n"

    storage.sync_overlay_to(job_id, [FakeFile()], target)
    env_file = target / ".env"
    assert env_file.is_file()
    assert "API_KEY=secret" in env_file.read_text()
