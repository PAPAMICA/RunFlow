"""Tests for git sync helpers."""

import pytest

from runflow_api.services.git_sync import (
    _auth_repository_url,
    _normalize_repository_url,
)


def test_normalize_rejects_ssh():
    with pytest.raises(RuntimeError, match="SSH"):
        _normalize_repository_url("git@github.com:org/repo.git")


def test_auth_repository_url_injects_token():
    url = _auth_repository_url("https://github.com/org/repo.git", "ghp_secret")
    assert "oauth2:" in url
    assert "ghp_secret" in url
    assert "github.com/org/repo.git" in url


def test_auth_repository_url_without_token():
    url = _auth_repository_url("https://github.com/org/repo.git", None)
    assert url == "https://github.com/org/repo.git"
