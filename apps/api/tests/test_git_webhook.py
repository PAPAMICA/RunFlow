"""Git webhook trigger tests."""

import hashlib
import hmac

from runflow_api.core.git_webhook import (
    git_push_matches_filter,
    parse_git_webhook_context,
    verify_git_webhook,
)


def test_verify_github_signature():
    secret = "test-secret"
    body = b'{"ref":"refs/heads/main"}'
    sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    headers = {"x-hub-signature-256": sig}
    assert verify_git_webhook("github", secret, headers, body) is True


def test_parse_github_context():
    payload = {
        "ref": "refs/heads/main",
        "repository": {"full_name": "org/repo"},
        "pusher": {"name": "dev"},
        "after": "abc123def456",
        "commits": [{}],
    }
    ctx = parse_git_webhook_context("github", payload, {"x-github-event": "push"})
    assert ctx["branch"] == "main"
    assert ctx["repository"] == "org/repo"


def test_git_push_branch_filter():
    config = {"branches": ["main"], "events": ["push"]}
    git_ctx = {"branch": "develop", "event": "push"}
    assert git_push_matches_filter(config, git_ctx, {}) is False
    git_ctx["branch"] = "main"
    assert git_push_matches_filter(config, git_ctx, {"x-github-event": "push"}) is True
