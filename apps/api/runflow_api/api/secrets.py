"""Secrets API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.deps import get_auth_context, require_permission
from runflow_api.db import get_db
from runflow_api.models import Secret
from runflow_api.services.audit import audit
from runflow_api.services.secrets import create_secret
from runflow_api.core.authorization import AuthContext

router = APIRouter(prefix="/secrets", tags=["secrets"])


class SecretCreate(BaseModel):
    name: str
    value: str
    scope: str = "organization"
    scope_id: str | None = None


class SecretResponse(BaseModel):
    id: str
    name: str
    scope: str
    scope_id: str | None
    configured: bool = True


@router.get("", response_model=list[SecretResponse])
async def list_secrets(
    auth: AuthContext = Depends(require_permission("admin")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Secret).where(Secret.organization_id == auth.organization_id)
    )
    return [
        SecretResponse(id=s.id, name=s.name, scope=s.scope, scope_id=s.scope_id)
        for s in result.scalars().all()
    ]


@router.post("", response_model=SecretResponse, status_code=201)
async def create_secret_endpoint(
    payload: SecretCreate,
    auth: AuthContext = Depends(require_permission("admin")),
    session: AsyncSession = Depends(get_db),
):
    secret = await create_secret(
        session, auth.organization_id, payload.name, payload.value,
        scope=payload.scope, scope_id=payload.scope_id,
    )
    await audit(session, "secret.create", organization_id=auth.organization_id,
                user_id=auth.user_id, resource_type="secret", resource_id=secret.id)
    return SecretResponse(id=secret.id, name=secret.name, scope=secret.scope, scope_id=secret.scope_id)


@router.delete("/{secret_id}", status_code=204)
async def delete_secret_endpoint(
    secret_id: str,
    auth: AuthContext = Depends(require_permission("admin")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Secret).where(
            Secret.id == secret_id,
            Secret.organization_id == auth.organization_id,
        )
    )
    secret = result.scalar_one_or_none()
    if not secret:
        raise HTTPException(status_code=404, detail="Secret not found")
    await session.delete(secret)
    await audit(session, "secret.delete", organization_id=auth.organization_id,
                user_id=auth.user_id, resource_type="secret", resource_id=secret_id)
