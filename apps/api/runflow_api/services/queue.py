"""Run queue and assignment service."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from runflow_api.core.run_state import validate_transition
from runflow_api.models import Job, Run, Worker, WorkerGroupMember
from runflow_api.services.valkey import publish_run_queued, publish_run_status
from runflow_api.utils import utcnow
from runflow_shared import RunStatus, WorkerStatus

logger = logging.getLogger(__name__)


def _worker_matches_job(worker: Worker, job: Job) -> bool:
    if job.worker_id and job.worker_id != worker.id:
        return False
    if job.worker_group_id:
        return False  # checked separately via group membership
    required_labels = job.worker_labels or {}
    worker_labels = worker.labels or {}
    for key, value in required_labels.items():
        if worker_labels.get(key) != value:
            return False
    return True


async def _worker_in_group(session: AsyncSession, worker_id: str, group_id: str) -> bool:
    result = await session.execute(
        select(WorkerGroupMember).where(
            WorkerGroupMember.worker_id == worker_id,
            WorkerGroupMember.group_id == group_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def enqueue_run(session: AsyncSession, run: Run) -> Run:
    run.status = RunStatus.QUEUED
    run.queued_at = utcnow()
    session.add(run)
    await session.flush()
    await publish_run_queued(run.id, run.organization_id)
    return run


async def claim_next_run(
    session: AsyncSession,
    worker: Worker,
    timeout_seconds: float = 25.0,
) -> Run | None:
    """Claim next queued run using FOR UPDATE SKIP LOCKED."""
    deadline = time.monotonic() + timeout_seconds

    while time.monotonic() < deadline:
        stmt = (
            select(Run)
            .where(Run.status == RunStatus.QUEUED, Run.organization_id == worker.organization_id)
            .order_by(Run.queued_at.asc())
            .with_for_update(skip_locked=True)
            .limit(10)
        )
        result = await session.execute(stmt)
        runs = result.scalars().all()

        for run in runs:
            job_result = await session.execute(select(Job).where(Job.id == run.job_id))
            job = job_result.scalar_one_or_none()
            if not job:
                continue
            if job.worker_group_id:
                if not await _worker_in_group(session, worker.id, job.worker_group_id):
                    continue
            elif not _worker_matches_job(worker, job):
                continue

            validate_transition(run.status, RunStatus.ASSIGNED)
            run.status = RunStatus.ASSIGNED
            run.worker_id = worker.id
            run.assigned_at = utcnow()
            worker.current_runs += 1
            session.add(run)
            session.add(worker)
            await session.flush()
            await publish_run_status(run.id, run.status)
            return run

        await session.commit()
        await asyncio.sleep(1.0)

    return None


async def reconcile_queued_runs(session: AsyncSession) -> int:
    """Republish queued runs that may have been missed."""
    result = await session.execute(select(Run).where(Run.status == RunStatus.QUEUED))
    runs = result.scalars().all()
    count = 0
    for run in runs:
        await publish_run_queued(run.id, run.organization_id)
        count += 1
    return count


async def transition_run(
    session: AsyncSession,
    run: Run,
    new_status: str,
    *,
    exit_code: int | None = None,
    result: dict | None = None,
    error: str | None = None,
) -> Run:
    validate_transition(run.status, new_status)
    now = utcnow()
    run.status = new_status

    if new_status == RunStatus.RUNNING and run.started_at is None:
        run.started_at = now
    if new_status in {
        RunStatus.SUCCESS,
        RunStatus.FAILED,
        RunStatus.TIMEOUT,
        RunStatus.CANCELLED,
        RunStatus.SKIPPED,
    }:
        run.finished_at = now
        if run.started_at:
            run.duration_seconds = (now - run.started_at).total_seconds()
        if run.worker_id:
            await session.execute(
                update(Worker)
                .where(Worker.id == run.worker_id, Worker.current_runs > 0)
                .values(current_runs=Worker.current_runs - 1)
            )

    if exit_code is not None:
        run.exit_code = exit_code
    if result is not None:
        run.result = result
    if error is not None:
        run.error = error

    session.add(run)
    await session.flush()
    await publish_run_status(run.id, run.status)

    if new_status in {RunStatus.SUCCESS, RunStatus.FAILED, RunStatus.TIMEOUT, RunStatus.CANCELLED}:
        from runflow_api.services.callbacks import deliver_callbacks_for_run
        from runflow_api.services.workflow_engine import on_run_completed
        deliver_callbacks_for_run(run.id)
        await on_run_completed(session, run)

    return run
