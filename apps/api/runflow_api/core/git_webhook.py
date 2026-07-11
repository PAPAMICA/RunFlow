"""Git provider webhook verification and context extraction."""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from typing import Any


def verify_git_webhook(
    provider: str,
    secret: str,
    headers: dict[str, str],
    body: bytes,
) -> bool:
    if not secret:
        return True

    provider = (provider or "generic").lower()

    if provider == "github":
        signature = headers.get("x-hub-signature-256", "")
        if not signature.startswith("sha256="):
            return False
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        return secrets.compare_digest(signature[7:], expected)

    if provider == "gitlab":
        token = headers.get("x-gitlab-token", "")
        return secrets.compare_digest(token, secret)

    if provider == "bitbucket":
        # Bitbucket Cloud: X-Hook-UUID optional; use shared secret via query or header
        token = headers.get("x-hook-uuid", headers.get("x-event-key", ""))
        if headers.get("x-runflow-secret"):
            return secrets.compare_digest(headers.get("x-runflow-secret", ""), secret)
        return bool(token) or secrets.compare_digest(
            headers.get("authorization", "").removeprefix("Bearer ").strip(), secret
        )

    return True


def parse_git_webhook_context(provider: str, payload: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
    provider = (provider or "generic").lower()
    git_ctx: dict[str, Any] = {"provider": provider, "event": headers.get("x-github-event") or headers.get("x-gitlab-event") or "push"}

    if provider == "github":
        ref = payload.get("ref", "")
        git_ctx.update(
            {
                "ref": ref,
                "branch": ref.removeprefix("refs/heads/") if ref.startswith("refs/heads/") else ref,
                "repository": (payload.get("repository") or {}).get("full_name"),
                "pusher": (payload.get("pusher") or {}).get("name"),
                "commit": (payload.get("after") or "")[:12],
                "commits": len(payload.get("commits") or []),
            }
        )
    elif provider == "gitlab":
        ref = payload.get("ref", "")
        git_ctx.update(
            {
                "ref": ref,
                "branch": ref.removeprefix("refs/heads/") if ref.startswith("refs/heads/") else ref,
                "repository": (payload.get("project") or {}).get("path_with_namespace"),
                "pusher": (payload.get("user_username") or payload.get("user_name")),
                "commit": (payload.get("checkout_sha") or payload.get("after") or "")[:12],
            }
        )
    else:
        git_ctx.update(
            {
                "ref": payload.get("ref", ""),
                "branch": payload.get("branch", payload.get("ref", "")),
                "repository": payload.get("repository", payload.get("repo", "")),
            }
        )

    return git_ctx


def git_push_matches_filter(config: dict[str, Any], git_ctx: dict[str, Any], headers: dict[str, str]) -> bool:
    branches = config.get("branches") or []
    if branches:
        branch = git_ctx.get("branch", "")
        if branch not in branches:
            return False

    events = config.get("events") or ["push"]
    event = (
        headers.get("x-github-event")
        or headers.get("x-gitlab-event")
        or git_ctx.get("event")
        or "push"
    )
    return event in events
