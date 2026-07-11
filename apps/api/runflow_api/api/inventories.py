"""Inventories API."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.deps import require_permission
from runflow_api.db import get_db
from runflow_api.core.encryption import decrypt
from runflow_api.models import Credential, Inventory
from runflow_api.services.audit import audit
from runflow_api.services.inventory_test import run_ansible_ping
from runflow_api.utils import new_ulid
from runflow_api.core.authorization import AuthContext

router = APIRouter(prefix="/inventories", tags=["inventories"])


class InventoryCreate(BaseModel):
    name: str
    source_type: str = "internal"
    content: str | None = None
    project_id: str | None = None
    git_config: dict[str, Any] | None = None


class InventoryUpdate(BaseModel):
    name: str | None = None
    content: str | None = None
    git_config: dict[str, Any] | None = None


class InventoryResponse(BaseModel):
    id: str
    name: str
    source_type: str


class InventoryDetailResponse(InventoryResponse):
    content: str | None = None
    project_id: str | None = None


class InventoryTestRequest(BaseModel):
    credential_id: str | None = None
    content: str | None = None


class InventoryTestResponse(BaseModel):
    success: bool
    output: str


async def _get_owned_inventory(
    session: AsyncSession, inventory_id: str, organization_id: str
) -> Inventory:
    result = await session.execute(
        select(Inventory).where(
            Inventory.id == inventory_id,
            Inventory.organization_id == organization_id,
        )
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory not found")
    return inv


@router.get("", response_model=list[InventoryResponse])
async def list_inventories(
    auth: AuthContext = Depends(require_permission("job:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Inventory).where(Inventory.organization_id == auth.organization_id)
    )
    return [InventoryResponse(id=i.id, name=i.name, source_type=i.source_type) for i in result.scalars().all()]


@router.get("/{inventory_id}", response_model=InventoryDetailResponse)
async def get_inventory(
    inventory_id: str,
    auth: AuthContext = Depends(require_permission("job:read")),
    session: AsyncSession = Depends(get_db),
):
    inv = await _get_owned_inventory(session, inventory_id, auth.organization_id)
    return InventoryDetailResponse(
        id=inv.id, name=inv.name, source_type=inv.source_type,
        content=inv.content, project_id=inv.project_id,
    )


@router.post("", response_model=InventoryResponse, status_code=201)
async def create_inventory(
    payload: InventoryCreate,
    auth: AuthContext = Depends(require_permission("job:write")),
    session: AsyncSession = Depends(get_db),
):
    inv = Inventory(
        id=new_ulid(), organization_id=auth.organization_id,
        project_id=payload.project_id, name=payload.name,
        source_type=payload.source_type, content=payload.content,
        git_config=payload.git_config,
    )
    session.add(inv)
    await session.flush()
    return InventoryResponse(id=inv.id, name=inv.name, source_type=inv.source_type)


@router.patch("/{inventory_id}", response_model=InventoryDetailResponse)
async def update_inventory(
    inventory_id: str,
    payload: InventoryUpdate,
    auth: AuthContext = Depends(require_permission("job:write")),
    session: AsyncSession = Depends(get_db),
):
    inv = await _get_owned_inventory(session, inventory_id, auth.organization_id)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(inv, field, value)
    await session.flush()
    return InventoryDetailResponse(
        id=inv.id, name=inv.name, source_type=inv.source_type,
        content=inv.content, project_id=inv.project_id,
    )


@router.delete("/{inventory_id}", status_code=204)
async def delete_inventory(
    inventory_id: str,
    auth: AuthContext = Depends(require_permission("job:write")),
    session: AsyncSession = Depends(get_db),
):
    inv = await _get_owned_inventory(session, inventory_id, auth.organization_id)
    await session.delete(inv)
    await audit(session, "inventory.delete", organization_id=auth.organization_id,
                user_id=auth.user_id, resource_type="inventory", resource_id=inventory_id)


@router.post("/{inventory_id}/test", response_model=InventoryTestResponse)
async def test_inventory(
    inventory_id: str,
    payload: InventoryTestRequest,
    auth: AuthContext = Depends(require_permission("job:write")),
    session: AsyncSession = Depends(get_db),
):
    inv = await _get_owned_inventory(session, inventory_id, auth.organization_id)
    content = payload.content if payload.content is not None else (inv.content or "")

    credential_data: dict[str, Any] | None = None
    if payload.credential_id:
        cred_result = await session.execute(
            select(Credential).where(
                Credential.id == payload.credential_id,
                Credential.organization_id == auth.organization_id,
            )
        )
        cred = cred_result.scalar_one_or_none()
        if not cred:
            raise HTTPException(status_code=404, detail="Credential not found")
        credential_data = json.loads(decrypt(cred.encrypted_data, cred.nonce))

    success, output = await run_ansible_ping(content, credential_data)
    return InventoryTestResponse(success=success, output=output)
