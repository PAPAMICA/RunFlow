"""Run completion triggers — chain jobs on success/failure."""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from runflow_api.db import async_session_factory
from runflow_api.models import Run, Trigger
from runflow_api.services.triggers import fire_trigger
from runflow_shared import RunStatus, TriggerType

logger = logging.getLogger(__name__)

TERMINAL_STATUSES = {
    RunStatus.SUCCESS,
    RunStatus.FAILED,
    RunStatus.TIMEOUT,
    RunStatus.CANCELLED,
}


def schedule_run_event_triggers(run_id: str) -> None:
    asyncio.create_task(_process_run_events(run_id))


async def _process_run_events(run_id: str) -> None:
    async with async_session_factory() as session:
        result = await session.execute(select(Run).where(Run.id == run_id))
        run = result.scalar_one_or_none()
        if not run or run.status not in TERMINAL_STATUSES:
            return

        triggers_result = await session.execute(
            select(Trigger).where(
                Trigger.trigger_type == TriggerType.RUN_EVENT,
                Trigger.enabled.is_(True),
                Trigger.organization_id == run.organization_id,
            )
        )
        triggers = triggers_result.scalars().all()

        for trigger in triggers:
            config = trigger.config or {}
            source_job_id = config.get("source_job_id")
            if source_job_id and source_job_id != run.job_id:
                continue

            on_status = config.get("on_status") or ["success", "failed"]
            status_key = run.status
            if status_key == RunStatus.SUCCESS and "success" not in on_status:
                continue
            if status_key == RunStatus.FAILED and "failed" not in on_status:
                continue
            if status_key == RunStatus.TIMEOUT and "timeout" not in on_status:
                continue
            if status_key == RunStatus.CANCELLED and "cancelled" not in on_status:
                continue

            context = {
                "run": {
                    "id": run.id,
                    "job_id": run.job_id,
                    "status": run.status,
                    "exit_code": run.exit_code,
                    "duration_seconds": run.duration_seconds,
                    "error": run.error,
                    "result": run.result,
                },
                "arguments": config.get("default_arguments", {}),
            }
            try:
                await fire_trigger(session, trigger, context, trigger_type_override=TriggerType.RUN_EVENT)
            except Exception:
                logger.exception("Run event trigger %s failed for run %s", trigger.id, run_id)

        await session.commit()
