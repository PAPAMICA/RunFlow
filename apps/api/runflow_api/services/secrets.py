"""Secret storage and resolution."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.core.encryption import decrypt, encrypt
from runflow_api.models import Secret
from runflow_api.utils import new_ulid

SCOPE_PRIORITY = ["job", "project", "organization", "global", "worker"]


async def create_secret(
    session: AsyncSession,
    organization_id: str,
    name: str,
    value: str,
    scope: str = "organization",
    scope_id: str | None = None,
) -> Secret:
    ct, nonce = encrypt(value)
    secret = Secret(
        id=new_ulid(),
        organization_id=organization_id,
        name=name,
        scope=scope,
        scope_id=scope_id,
        encrypted_value=ct,
        nonce=nonce,
    )
    session.add(secret)
    await session.flush()
    return secret


async def resolve_secrets_for_run(
    session: AsyncSession,
    organization_id: str,
    *,
    job_id: str | None = None,
    project_id: str | None = None,
    worker_id: str | None = None,
    secret_refs: list[str] | None = None,
) -> dict[str, str]:
    """Resolve secrets with priority job > project > organization > global."""
    result = await session.execute(
        select(Secret).where(Secret.organization_id == organization_id)
    )
    secrets = result.scalars().all()
    resolved: dict[str, str] = {}

    for name in secret_refs or []:
        candidates = [s for s in secrets if s.name == name]
        best = _pick_best(candidates, job_id=job_id, project_id=project_id, worker_id=worker_id)
        if best:
            resolved[name] = decrypt(best.encrypted_value, best.nonce)

    return resolved


def _pick_best(
    candidates: list[Secret],
    *,
    job_id: str | None,
    project_id: str | None,
    worker_id: str | None,
) -> Secret | None:
    context = {"job": job_id, "project": project_id, "worker": worker_id, "organization": None, "global": None}
    for scope in SCOPE_PRIORITY:
        scope_id = context.get(scope)
        for s in candidates:
            if s.scope == scope and (scope in ("global", "organization") or s.scope_id == scope_id):
                return s
    return None
