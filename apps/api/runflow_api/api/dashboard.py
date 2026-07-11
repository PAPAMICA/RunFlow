"""Dashboard statistics."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.core.authorization import AuthContext
from runflow_api.deps import require_permission
from runflow_api.db import get_db
from runflow_api.models import Run, Worker
from runflow_api.schemas import DashboardStats, RunResponse
from runflow_api.api.runs import _run_to_response
from runflow_shared import RunStatus, WorkerStatus

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def dashboard_stats(
    auth: AuthContext = Depends(require_permission("org:read")),
    session: AsyncSession = Depends(get_db),
):
    today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    runs_today_result = await session.execute(
        select(func.count(Run.id)).where(
            Run.organization_id == auth.organization_id, Run.queued_at >= today
        )
    )
    runs_today = runs_today_result.scalar_one()

    success_result = await session.execute(
        select(func.count(Run.id)).where(
            Run.organization_id == auth.organization_id,
            Run.queued_at >= today,
            Run.status == RunStatus.SUCCESS,
        )
    )
    success_count = success_result.scalar_one()
    success_rate = (success_count / runs_today * 100) if runs_today else 0.0

    running_result = await session.execute(
        select(func.count(Run.id)).where(
            Run.organization_id == auth.organization_id,
            Run.status.in_([RunStatus.RUNNING, RunStatus.PREPARING, RunStatus.ASSIGNED]),
        )
    )
    running_jobs = running_result.scalar_one()

    failed_result = await session.execute(
        select(func.count(Run.id)).where(
            Run.organization_id == auth.organization_id,
            Run.queued_at >= today,
            Run.status == RunStatus.FAILED,
        )
    )
    failed_jobs = failed_result.scalar_one()

    workers_result = await session.execute(
        select(func.count(Worker.id)).where(
            Worker.organization_id == auth.organization_id,
            Worker.status == WorkerStatus.ONLINE,
        )
    )
    online_workers = workers_result.scalar_one()

    return DashboardStats(
        runs_today=runs_today,
        success_rate=round(success_rate, 1),
        running_jobs=running_jobs,
        failed_jobs=failed_jobs,
        online_workers=online_workers,
    )


@router.get("/recent-runs", response_model=list[RunResponse])
async def recent_runs(
    auth: AuthContext = Depends(require_permission("run:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Run)
        .where(Run.organization_id == auth.organization_id)
        .order_by(Run.queued_at.desc())
        .limit(10)
    )
    return [_run_to_response(r) for r in result.scalars().all()]
