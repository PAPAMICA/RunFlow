"""Worker health monitoring."""

from __future__ import annotations

import logging
from datetime import timedelta

from sqlalchemy import select, update

from runflow_api.config import get_settings
from runflow_api.db import async_session_factory
from runflow_api.models import Worker
from runflow_api.utils import utcnow
from runflow_shared import WorkerStatus

logger = logging.getLogger(__name__)


async def mark_offline_workers() -> int:
    settings = get_settings()
    threshold = utcnow() - timedelta(seconds=settings.worker_offline_threshold_seconds)
    async with async_session_factory() as session:
        result = await session.execute(
            select(Worker).where(
                Worker.status == WorkerStatus.ONLINE,
                Worker.last_seen_at < threshold,
            )
        )
        workers = result.scalars().all()
        for w in workers:
            w.status = WorkerStatus.OFFLINE
            session.add(w)
        await session.commit()
        return len(workers)


async def worker_health_loop(interval: int = 30) -> None:
    import asyncio
    while True:
        try:
            count = await mark_offline_workers()
            if count:
                logger.info("Marked %d workers offline", count)
        except Exception:
            logger.exception("Worker health check failed")
        await asyncio.sleep(interval)
