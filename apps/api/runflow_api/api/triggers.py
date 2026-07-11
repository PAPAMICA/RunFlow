"""Triggers CRUD API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.deps import require_permission
from runflow_api.db import get_db
from runflow_api.models import Trigger
from runflow_api.services.triggers import generate_hook_token
from runflow_api.utils import new_ulid
from runflow_api.core.authorization import AuthContext
from runflow_shared import TriggerType

router = APIRouter(prefix="/triggers", tags=["triggers"])


class TriggerCreate(BaseModel):
    name: str
    trigger_type: str
    target_type: str = "job"
    target_id: str
    project_id: str | None = None
    config: dict[str, Any] = {}


class TriggerResponse(BaseModel):
    id: str
    name: str
    trigger_type: str
    target_type: str
    target_id: str
    enabled: bool
    hook_token: str | None = None
    config: dict[str, Any]


@router.get("", response_model=list[TriggerResponse])
async def list_triggers(
    auth: AuthContext = Depends(require_permission("job:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Trigger).where(Trigger.organization_id == auth.organization_id)
    )
    return [_to_response(t) for t in result.scalars().all()]


@router.post("", response_model=TriggerResponse, status_code=201)
async def create_trigger(
    payload: TriggerCreate,
    auth: AuthContext = Depends(require_permission("job:write")),
    session: AsyncSession = Depends(get_db),
):
    hook_token = generate_hook_token() if payload.trigger_type == TriggerType.WEBHOOK else None
    trigger = Trigger(
        id=new_ulid(),
        organization_id=auth.organization_id,
        project_id=payload.project_id,
        name=payload.name,
        trigger_type=payload.trigger_type,
        target_type=payload.target_type,
        target_id=payload.target_id,
        hook_token=hook_token,
        config=payload.config,
    )
    session.add(trigger)
    await session.flush()
    return _to_response(trigger)


@router.get("/{trigger_id}", response_model=TriggerResponse)
async def get_trigger(
    trigger_id: str,
    auth: AuthContext = Depends(require_permission("job:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Trigger).where(Trigger.id == trigger_id, Trigger.organization_id == auth.organization_id)
    )
    trigger = result.scalar_one_or_none()
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found")
    return _to_response(trigger)


def _to_response(t: Trigger) -> TriggerResponse:
    return TriggerResponse(
        id=t.id, name=t.name, trigger_type=t.trigger_type,
        target_type=t.target_type, target_id=t.target_id,
        enabled=t.enabled, hook_token=t.hook_token, config=t.config or {},
    )
