"""Triggers CRUD API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.deps import require_permission
from runflow_api.db import get_db
from runflow_api.models import Trigger
from runflow_api.services.triggers import generate_hook_token
from runflow_api.utils import new_ulid
from runflow_api.core.authorization import AuthContext
from runflow_shared import HOOK_TRIGGER_TYPES, TriggerType

router = APIRouter(prefix="/triggers", tags=["triggers"])

VALID_TRIGGER_TYPES = {t.value for t in TriggerType if t not in {TriggerType.MANUAL, TriggerType.API, TriggerType.WORKFLOW}}


class TriggerCreate(BaseModel):
    name: str
    trigger_type: str
    target_type: str = "job"
    target_id: str
    project_id: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)


class TriggerUpdate(BaseModel):
    name: str | None = None
    enabled: bool | None = None
    config: dict[str, Any] | None = None
    target_id: str | None = None


class TriggerResponse(BaseModel):
    id: str
    name: str
    trigger_type: str
    target_type: str
    target_id: str
    enabled: bool
    hook_token: str | None = None
    config: dict[str, Any]
    project_id: str | None = None


@router.get("", response_model=list[TriggerResponse])
async def list_triggers(
    auth: AuthContext = Depends(require_permission("job:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Trigger).where(Trigger.organization_id == auth.organization_id).order_by(Trigger.name)
    )
    return [_to_response(t) for t in result.scalars().all()]


@router.post("", response_model=TriggerResponse, status_code=201)
async def create_trigger(
    payload: TriggerCreate,
    auth: AuthContext = Depends(require_permission("job:write")),
    session: AsyncSession = Depends(get_db),
):
    if payload.trigger_type not in VALID_TRIGGER_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid trigger_type: {payload.trigger_type}")

    hook_token = generate_hook_token() if payload.trigger_type in HOOK_TRIGGER_TYPES else None
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
    trigger = await _get_trigger(session, auth, trigger_id)
    return _to_response(trigger)


@router.patch("/{trigger_id}", response_model=TriggerResponse)
async def update_trigger(
    trigger_id: str,
    payload: TriggerUpdate,
    auth: AuthContext = Depends(require_permission("job:write")),
    session: AsyncSession = Depends(get_db),
):
    trigger = await _get_trigger(session, auth, trigger_id)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(trigger, field, value)
    session.add(trigger)
    await session.flush()
    return _to_response(trigger)


@router.delete("/{trigger_id}", status_code=204)
async def delete_trigger(
    trigger_id: str,
    auth: AuthContext = Depends(require_permission("job:write")),
    session: AsyncSession = Depends(get_db),
):
    trigger = await _get_trigger(session, auth, trigger_id)
    await session.delete(trigger)


async def _get_trigger(session: AsyncSession, auth: AuthContext, trigger_id: str) -> Trigger:
    result = await session.execute(
        select(Trigger).where(Trigger.id == trigger_id, Trigger.organization_id == auth.organization_id)
    )
    trigger = result.scalar_one_or_none()
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found")
    return trigger


def _to_response(t: Trigger) -> TriggerResponse:
    return TriggerResponse(
        id=t.id,
        name=t.name,
        trigger_type=t.trigger_type,
        target_type=t.target_type,
        target_id=t.target_id,
        enabled=t.enabled,
        hook_token=t.hook_token,
        config=t.config or {},
        project_id=t.project_id,
    )
