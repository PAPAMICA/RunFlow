"""Trigger execution service."""

from __future__ import annotations

import secrets
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.core.template_engine import render_argument_mapping
from runflow_api.models import Job, Run, Trigger
from runflow_api.services.queue import enqueue_run
from runflow_api.services.workflow_engine import start_workflow_run
from runflow_api.utils import new_ulid
from runflow_shared import TriggerType


def generate_hook_token() -> str:
    return secrets.token_urlsafe(32)


async def fire_trigger(
    session: AsyncSession,
    trigger: Trigger,
    context: dict[str, Any],
    *,
    trigger_type_override: str | None = None,
) -> Run | Any:
    """Fire a trigger against its target (job or workflow)."""
    config = trigger.config or {}
    argument_mapping = config.get("argument_mapping", {})

    if argument_mapping:
        arguments = render_argument_mapping(argument_mapping, context)
    else:
        arguments = context.get("arguments", {})

    if trigger.target_type == "workflow":
        return await start_workflow_run(
            session,
            workflow_id=trigger.target_id,
            organization_id=trigger.organization_id,
            arguments=arguments,
            trigger_id=trigger.id,
        )

    # Target is a job
    from sqlalchemy import select
    from runflow_api.models import Job

    job_result = await session.execute(select(Job).where(Job.id == trigger.target_id))
    job = job_result.scalar_one_or_none()
    if not job or not job.enabled:
        raise ValueError("Target job not found or disabled")

    run = Run(
        id=new_ulid(),
        organization_id=trigger.organization_id,
        job_id=job.id,
        trigger_type=trigger_type_override or trigger.trigger_type,
        trigger_id=trigger.id,
        arguments=arguments,
    )
    return await enqueue_run(session, run)
