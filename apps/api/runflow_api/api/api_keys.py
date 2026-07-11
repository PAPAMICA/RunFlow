"""API key management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.core.authorization import AuthContext
from runflow_api.deps import require_permission
from runflow_api.db import get_db
from runflow_api.models import APIKey
from runflow_api.schemas import APIKeyCreate, APIKeyCreatedResponse, APIKeyResponse
from runflow_api.utils import generate_api_key, new_ulid

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


@router.get("", response_model=list[APIKeyResponse])
async def list_api_keys(
    auth: AuthContext = Depends(require_permission("apikey:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(APIKey).where(APIKey.organization_id == auth.organization_id)
    )
    keys = result.scalars().all()
    return [
        APIKeyResponse(
            id=k.id, name=k.name, prefix=k.prefix, scopes=k.scopes or [], enabled=k.enabled
        )
        for k in keys
    ]


@router.post("", response_model=APIKeyCreatedResponse, status_code=201)
async def create_api_key(
    payload: APIKeyCreate,
    auth: AuthContext = Depends(require_permission("apikey:write")),
    session: AsyncSession = Depends(get_db),
):
    full_key, prefix, key_hash = generate_api_key()
    api_key = APIKey(
        id=new_ulid(),
        organization_id=auth.organization_id,
        name=payload.name,
        prefix=prefix,
        key_hash=key_hash,
        scopes=payload.scopes,
        project_id=payload.project_id,
        allowed_job_ids=payload.allowed_job_ids,
    )
    session.add(api_key)
    await session.flush()
    return APIKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        prefix=api_key.prefix,
        scopes=api_key.scopes or [],
        enabled=api_key.enabled,
        key=full_key,
    )
