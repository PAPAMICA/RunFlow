"""Credential storage and resolution."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.core.encryption import decrypt, encrypt
from runflow_api.models import Credential
from runflow_api.utils import new_ulid


async def create_credential(
    session: AsyncSession,
    organization_id: str,
    name: str,
    credential_type: str,
    data: dict[str, Any],
    project_id: str | None = None,
) -> Credential:
    ct, nonce = encrypt(json.dumps(data))
    cred = Credential(
        id=new_ulid(),
        organization_id=organization_id,
        project_id=project_id,
        name=name,
        credential_type=credential_type,
        encrypted_data=ct,
        nonce=nonce,
    )
    session.add(cred)
    await session.flush()
    return cred


async def get_credential_data(session: AsyncSession, credential_id: str) -> dict[str, Any]:
    result = await session.execute(select(Credential).where(Credential.id == credential_id))
    cred = result.scalar_one_or_none()
    if not cred:
        raise ValueError("Credential not found")
    return json.loads(decrypt(cred.encrypted_data, cred.nonce))


async def resolve_credentials_for_run(
    session: AsyncSession,
    credential_refs: list[str] | None,
) -> list[dict[str, Any]]:
    if not credential_refs:
        return []
    resolved = []
    for cred_id in credential_refs:
        try:
            data = await get_credential_data(session, cred_id)
            resolved.append({"id": cred_id, "data": data})
        except ValueError:
            continue
    return resolved
