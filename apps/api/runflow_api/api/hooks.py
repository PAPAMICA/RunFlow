"""Public webhook endpoint."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.core.webhook_auth import verify_webhook_auth
from runflow_api.db import get_db
from runflow_api.models import Trigger
from runflow_api.services.audit import audit
from runflow_api.services.triggers import fire_trigger
from runflow_shared import TriggerType

router = APIRouter(prefix="/hooks", tags=["hooks"])


@router.post("/{hook_token}")
async def receive_webhook(
    hook_token: str,
    request: Request,
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Trigger).where(
            Trigger.hook_token == hook_token,
            Trigger.trigger_type == TriggerType.WEBHOOK,
            Trigger.enabled.is_(True),
        )
    )
    trigger = result.scalar_one_or_none()
    if not trigger:
        raise HTTPException(status_code=404, detail="Webhook not found")

    body = await request.body()
    try:
        payload = json.loads(body) if body else {}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    config = trigger.config or {}
    auth_type = config.get("auth_type", "none")
    headers = {k.lower(): v for k, v in request.headers.items()}
    if not verify_webhook_auth(auth_type, config.get("auth_config", {}), headers, body, request.headers.get("authorization")):
        raise HTTPException(status_code=401, detail="Webhook authentication failed")

    context = {"webhook": {"body": payload, "headers": dict(request.headers)}, "arguments": {}}
    run = await fire_trigger(session, trigger, context, trigger_type_override=TriggerType.WEBHOOK)
    await audit(session, "trigger.webhook", organization_id=trigger.organization_id,
                resource_type="trigger", resource_id=trigger.id)
    await session.commit()
    return {"run_id": run.id if hasattr(run, "id") else str(run), "status": "queued"}
