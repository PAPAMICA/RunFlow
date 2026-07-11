"""Tests for authorization."""

from runflow_api.core.authorization import AuthContext


def test_owner_has_admin():
    auth = AuthContext(user_id="u1", role="owner")
    assert auth.has_permission("admin")
    assert auth.has_permission("job:run")


def test_viewer_cannot_run():
    auth = AuthContext(user_id="u1", role="viewer")
    assert auth.has_permission("job:read")
    assert not auth.has_permission("job:run")


def test_api_key_scopes():
    auth = AuthContext(api_key_id="k1", scopes=["job:run"])
    assert auth.has_permission("job:run")
    assert auth.has_permission("run:read")
    assert not auth.has_permission("admin")


def test_api_key_job_restriction():
    auth = AuthContext(
        api_key_id="k1",
        scopes=["job:run"],
        allowed_job_ids=["job-1"],
    )
    assert auth.can_run_job("job-1", "proj-1")
    assert not auth.can_run_job("job-2", "proj-1")
