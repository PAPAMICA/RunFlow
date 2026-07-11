"""Tests for git credential resolution."""

from runflow_shared.git_sync import default_git_username


def test_github_default_user():
    assert default_git_username("github.com") == "x-access-token"


def test_gitlab_default_user():
    assert default_git_username("gitlab.com") == "oauth2"
