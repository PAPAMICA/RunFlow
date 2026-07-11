"""Inventories API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.deps import require_permission
from runflow_api.db import get_db
from runflow_api.models import Inventory
from runflow_api.utils import new_ulid
from runflow_api.core.authorization import AuthContext

router = APIRouter(prefix="/inventories", tags=["inventories"])


class InventoryCreate(BaseModel):
    name: str
    source_type: str = "internal"
    content: str | None = None
    project_id: str | None = None
    git_config: dict[str, Any] | None = None


class InventoryResponse(BaseModel):
    id: str
    name: str
    source_type: str


@router.get("", response_model=list[InventoryResponse])
async def list_inventories(
    auth: AuthContext = Depends(require_permission("job:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Inventory).where(Inventory.organization_id == auth.organization_id)
    )
    return [InventoryResponse(id=i.id, name=i.name, source_type=i.source_type) for i in result.scalars().all()]


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
