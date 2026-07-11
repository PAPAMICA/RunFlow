"""Worker health monitoring."""

from __future__ import annotations

import logging
from datetime import timedelta

from sqlalchemy import select, update

from runflow_api.config import get_settings
from runflow_api.db import async_session_factory
from runflow_api.models import Run, Worker
from runflow_api.services.queue import transition_run
from runflow_api.utils import utcnow
from runflow_shared import RunStatus, WorkerStatus

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


async def reap_orphaned_runs() -> int:
    """Fail runs whose worker went offline while they were still active."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(Run)
            .join(Worker, Run.worker_id == Worker.id)
            .where(
                Worker.status == WorkerStatus.OFFLINE,
                Run.status.in_(
                    [RunStatus.ASSIGNED, RunStatus.PREPARING, RunStatus.RUNNING]
                ),
            )
        )
        runs = result.scalars().all()
        for run in runs:
            await transition_run(
                session,
                run,
                RunStatus.FAILED,
                error="Worker hors ligne — exécution orpheline récupérée",
            )
        await session.commit()
        return len(runs)


async def worker_health_loop(interval: int = 30) -> None:
    import asyncio
    while True:
        try:
            count = await mark_offline_workers()
            if count:
                logger.info("Marked %d workers offline", count)
            reaped = await reap_orphaned_runs()
            if reaped:
                logger.info("Reaped %d orphaned runs", reaped)
        except Exception:
            logger.exception("Worker health check failed")
        await asyncio.sleep(interval)
