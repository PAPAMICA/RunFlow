"""Public webhook endpoint."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.core.git_webhook import (
    git_push_matches_filter,
    parse_git_webhook_context,
    verify_git_webhook,
)
from runflow_api.core.webhook_auth import verify_webhook_auth
from runflow_api.db import get_db
from runflow_api.models import Trigger
from runflow_api.services.audit import audit
from runflow_api.services.triggers import fire_trigger
from runflow_shared import HOOK_TRIGGER_TYPES, TriggerType

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
            Trigger.trigger_type.in_(list(HOOK_TRIGGER_TYPES)),
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

    headers = {k.lower(): v for k, v in request.headers.items()}
    config = trigger.config or {}

    if trigger.trigger_type == TriggerType.GIT_PUSH:
        provider = config.get("provider", "github")
        secret = config.get("secret", "")
        if not verify_git_webhook(provider, secret, headers, body):
            raise HTTPException(status_code=401, detail="Git webhook authentication failed")
        git_ctx = parse_git_webhook_context(provider, payload, headers)
        if not git_push_matches_filter(config, git_ctx, headers):
            return {"status": "ignored", "reason": "event or branch filter mismatch"}
        context = {
            "webhook": {"body": payload, "headers": dict(request.headers)},
            "git": git_ctx,
            "arguments": {},
        }
        override = TriggerType.GIT_PUSH
        audit_action = "trigger.git_push"
    else:
        auth_type = config.get("auth_type", "none")
        if not verify_webhook_auth(
            auth_type,
            config.get("auth_config", {}),
            headers,
            body,
            request.headers.get("authorization"),
        ):
            raise HTTPException(status_code=401, detail="Webhook authentication failed")
        context = {"webhook": {"body": payload, "headers": dict(request.headers)}, "arguments": {}}
        override = TriggerType.WEBHOOK
        audit_action = "trigger.webhook"

    run = await fire_trigger(session, trigger, context, trigger_type_override=override)
    await audit(
        session,
        audit_action,
        organization_id=trigger.organization_id,
        resource_type="trigger",
        resource_id=trigger.id,
    )
    await session.commit()
    return {"run_id": run.id if hasattr(run, "id") else str(run), "status": "queued"}
