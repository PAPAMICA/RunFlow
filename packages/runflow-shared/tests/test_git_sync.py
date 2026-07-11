"""Tests for shared git sync helpers."""

import pytest

from runflow_shared.git_sync import _auth_repository_url, _normalize_repository_url, default_git_username


def test_normalize_rejects_ssh():
    with pytest.raises(RuntimeError, match="SSH"):
        _normalize_repository_url("git@github.com:org/repo.git")


def test_default_username_github():
    assert default_git_username("github.com") == "x-access-token"


def test_auth_repository_url_github_pat():
    url = _auth_repository_url("https://github.com/org/repo.git", "ghp_secret")
    assert "x-access-token:ghp_secret@github.com" in url
