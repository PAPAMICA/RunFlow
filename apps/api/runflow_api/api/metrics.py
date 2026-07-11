"""Prometheus metrics endpoint."""

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse
from sqlalchemy import func, select

from runflow_api.db import async_session_factory
from runflow_api.models import Run, Worker
from runflow_shared import RunStatus, WorkerStatus

router = APIRouter(tags=["metrics"])


@router.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    async with async_session_factory() as session:
        runs_total = await session.scalar(select(func.count(Run.id))) or 0
        runs_running = await session.scalar(
            select(func.count(Run.id)).where(
                Run.status.in_([RunStatus.RUNNING, RunStatus.PREPARING, RunStatus.ASSIGNED])
            )
        ) or 0
        queue_depth = await session.scalar(
            select(func.count(Run.id)).where(Run.status == RunStatus.QUEUED)
        ) or 0
        workers_online = await session.scalar(
            select(func.count(Worker.id)).where(Worker.status == WorkerStatus.ONLINE)
        ) or 0

    lines = [
        "# HELP runflow_runs_total Total number of runs",
        "# TYPE runflow_runs_total counter",
        f"runflow_runs_total {runs_total}",
        "# HELP runflow_runs_running Currently running runs",
        "# TYPE runflow_runs_running gauge",
        f"runflow_runs_running {runs_running}",
        "# HELP runflow_queue_depth Queued runs waiting for worker",
        "# TYPE runflow_queue_depth gauge",
        f"runflow_queue_depth {queue_depth}",
        "# HELP runflow_workers_online Online workers",
        "# TYPE runflow_workers_online gauge",
        f"runflow_workers_online {workers_online}",
    ]
    return "\n".join(lines) + "\n"
