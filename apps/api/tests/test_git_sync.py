"""Tests for git sync helpers."""

import pytest

from runflow_api.services.git_auth import default_git_username
from runflow_api.services.git_sync import _auth_repository_url, _normalize_repository_url


def test_normalize_rejects_ssh():
    with pytest.raises(RuntimeError, match="SSH"):
        _normalize_repository_url("git@github.com:org/repo.git")


def test_default_username_github():
    assert default_git_username("github.com") == "x-access-token"


def test_default_username_gitlab():
    assert default_git_username("gitlab.com") == "oauth2"


def test_auth_repository_url_github_pat():
    url = _auth_repository_url("https://github.com/org/repo.git", "ghp_secret")
    assert "x-access-token:ghp_secret@github.com" in url


def test_auth_repository_url_gitlab_token():
    url = _auth_repository_url("https://gitlab.com/org/repo.git", "glpat_secret")
    assert "oauth2:glpat_secret@gitlab.com" in url


def test_auth_repository_url_without_token():
    url = _auth_repository_url("https://github.com/org/repo.git", None)
    assert url == "https://github.com/org/repo.git"


def test_normalize_strips_embedded_credentials():
    url = _normalize_repository_url("https://user:old@github.com/org/repo.git")
    assert url == "https://github.com/org/repo.git"
