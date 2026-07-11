"""PostgreSQL-backed cron scheduler."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from croniter import croniter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.db import async_session_factory
from runflow_api.models import ScheduleLock, Trigger
from runflow_api.services.triggers import fire_trigger
from runflow_api.utils import new_ulid, utcnow
from runflow_shared import TriggerType

logger = logging.getLogger(__name__)


def _cron_expression(config: dict) -> str:
    mode = config.get("mode", "advanced")
    if mode == "simple":
        interval = config.get("interval", "daily")
        if interval == "every_minutes":
            return f"*/{config.get('minutes', 5)} * * * *"
        if interval == "hourly":
            return "0 * * * *"
        if interval == "daily":
            hour = config.get("hour", 0)
            return f"0 {hour} * * *"
        if interval == "weekly":
            return f"0 {config.get('hour', 0)} * * {config.get('day_of_week', 0)}"
        if interval == "monthly":
            return f"0 {config.get('hour', 0)} {config.get('day', 1)} * *"
    return config.get("cron", "0 * * * *")


async def run_scheduler_tick() -> int:
    fired = 0
    async with async_session_factory() as session:
        result = await session.execute(
            select(Trigger).where(
                Trigger.trigger_type == TriggerType.SCHEDULE,
                Trigger.enabled.is_(True),
            )
        )
        triggers = result.scalars().all()
        now = utcnow()

        for trigger in triggers:
            config = trigger.config or {}
            tz_name = config.get("timezone", "UTC")
            try:
                tz = ZoneInfo(tz_name)
            except Exception:
                tz = ZoneInfo("UTC")
            local_now = now.astimezone(tz)
            cron_expr = _cron_expression(config)
            cron = croniter(cron_expr, local_now)
            prev = cron.get_prev(datetime)
            fire_key = prev.strftime("%Y%m%d%H%M")

            try:
                lock = ScheduleLock(
                    id=new_ulid(),
                    trigger_id=trigger.id,
                    fire_key=fire_key,
                )
                session.add(lock)
                await session.flush()
                await fire_trigger(session, trigger, {"arguments": config.get("default_arguments", {})})
                fired += 1
            except Exception:
                await session.rollback()
                continue

        if fired:
            await session.commit()
    return fired


async def scheduler_loop(interval: int = 30) -> None:
    import asyncio
    while True:
        try:
            count = await run_scheduler_tick()
            if count:
                logger.info("Scheduler fired %d triggers", count)
        except Exception:
            logger.exception("Scheduler tick failed")
        await asyncio.sleep(interval)
