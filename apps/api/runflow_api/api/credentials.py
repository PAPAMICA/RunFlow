"""Credentials API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.deps import require_permission
from runflow_api.db import get_db
from runflow_api.models import Credential
from runflow_api.services.audit import audit
from runflow_api.services.credentials import create_credential, update_credential
from runflow_api.core.authorization import AuthContext

router = APIRouter(prefix="/credentials", tags=["credentials"])


class CredentialCreate(BaseModel):
    name: str
    credential_type: str
    data: dict[str, Any]
    project_id: str | None = None


class CredentialUpdate(BaseModel):
    name: str | None = None
    data: dict[str, Any] | None = None


class CredentialResponse(BaseModel):
    id: str
    name: str
    credential_type: str
    configured: bool = True


@router.get("", response_model=list[CredentialResponse])
async def list_credentials(
    auth: AuthContext = Depends(require_permission("admin")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Credential).where(Credential.organization_id == auth.organization_id)
    )
    return [
        CredentialResponse(id=c.id, name=c.name, credential_type=c.credential_type)
        for c in result.scalars().all()
    ]


@router.post("", response_model=CredentialResponse, status_code=201)
async def create_credential_endpoint(
    payload: CredentialCreate,
    auth: AuthContext = Depends(require_permission("admin")),
    session: AsyncSession = Depends(get_db),
):
    cred = await create_credential(
        session, auth.organization_id, payload.name,
        payload.credential_type, payload.data, payload.project_id,
    )
    await audit(session, "credential.create", organization_id=auth.organization_id,
                user_id=auth.user_id, resource_type="credential", resource_id=cred.id)
    return CredentialResponse(id=cred.id, name=cred.name, credential_type=cred.credential_type)


async def _get_owned_credential(
    session: AsyncSession, credential_id: str, organization_id: str
) -> Credential:
    result = await session.execute(
        select(Credential).where(
            Credential.id == credential_id,
            Credential.organization_id == organization_id,
        )
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    return cred


@router.patch("/{credential_id}", response_model=CredentialResponse)
async def update_credential_endpoint(
    credential_id: str,
    payload: CredentialUpdate,
    auth: AuthContext = Depends(require_permission("admin")),
    session: AsyncSession = Depends(get_db),
):
    cred = await _get_owned_credential(session, credential_id, auth.organization_id)
    cred = await update_credential(session, cred, name=payload.name, data=payload.data)
    await audit(session, "credential.update", organization_id=auth.organization_id,
                user_id=auth.user_id, resource_type="credential", resource_id=cred.id)
    return CredentialResponse(id=cred.id, name=cred.name, credential_type=cred.credential_type)


@router.delete("/{credential_id}", status_code=204)
async def delete_credential_endpoint(
    credential_id: str,
    auth: AuthContext = Depends(require_permission("admin")),
    session: AsyncSession = Depends(get_db),
):
    cred = await _get_owned_credential(session, credential_id, auth.organization_id)
    await session.delete(cred)
    await audit(session, "credential.delete", organization_id=auth.organization_id,
                user_id=auth.user_id, resource_type="credential", resource_id=credential_id)
