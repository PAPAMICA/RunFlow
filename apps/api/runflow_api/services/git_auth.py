"""Resolve Git HTTPS authentication for private repositories."""

from __future__ import annotations

from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.models import Credential
from runflow_api.services.credentials import get_credential_data


def default_git_username(host: str) -> str:
    host = host.lower()
    if "github.com" in host:
        return "x-access-token"
    if "gitlab" in host:
        return "oauth2"
    if "bitbucket.org" in host:
        return "x-token-auth"
    return "git"


def detect_git_host(url: str) -> str:
    try:
        host = urlparse(url.strip()).hostname or ""
    except Exception:
        return ""
    return host.lower()


async def resolve_git_config_auth(
    session: AsyncSession,
    organization_id: str,
    git_config: dict,
) -> dict:
    """Enrich git_config with token/username from a stored credential."""
    resolved = dict(git_config)
    credential_id = resolved.get("credential_id")
    if not credential_id:
        return resolved

    result = await session.execute(
        select(Credential).where(
            Credential.id == credential_id,
            Credential.organization_id == organization_id,
        )
    )
    if not result.scalar_one_or_none():
        raise ValueError("Credential Git introuvable")

    data = await get_credential_data(session, credential_id)
    token = data.get("token") or data.get("password") or data.get("access_token")
    username = data.get("username")

    if token:
        resolved["access_token"] = str(token)
    if username:
        resolved["username"] = str(username)
    return resolved
