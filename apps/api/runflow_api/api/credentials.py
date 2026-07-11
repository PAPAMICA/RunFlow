"""Credentials API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.deps import require_permission
from runflow_api.db import get_db
from runflow_api.models import Credential
from runflow_api.services.audit import audit
from runflow_api.services.credentials import create_credential
from runflow_api.core.authorization import AuthContext

router = APIRouter(prefix="/credentials", tags=["credentials"])


class CredentialCreate(BaseModel):
    name: str
    credential_type: str
    data: dict[str, Any]
    project_id: str | None = None


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
