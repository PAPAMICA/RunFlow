"""Worker registration and management (admin)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.core.authorization import AuthContext
from runflow_api.deps import require_permission
from runflow_api.db import get_db
from runflow_api.models import Worker, WorkerGroup, WorkerGroupMember
from runflow_api.utils import generate_worker_token, new_ulid, utcnow

router = APIRouter(prefix="/workers", tags=["workers-admin"])


class WorkerCreateRequest(BaseModel):
    name: str
    max_concurrency: int = 5
    labels: dict[str, str] = {}


class WorkerCreatedResponse(BaseModel):
    id: str
    name: str
    token: str


class WorkerResponse(BaseModel):
    id: str
    name: str
    status: str
    hostname: str | None
    version: str | None
    labels: dict[str, str]
    current_runs: int
    max_concurrency: int
    last_seen_at: str | None


class WorkerGroupCreate(BaseModel):
    name: str
    worker_ids: list[str] = []


class WorkerGroupResponse(BaseModel):
    id: str
    name: str
    worker_count: int


@router.get("", response_model=list[WorkerResponse])
async def list_workers(
    auth: AuthContext = Depends(require_permission("worker:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Worker).where(Worker.organization_id == auth.organization_id)
    )
    return [
        WorkerResponse(
            id=w.id, name=w.name, status=w.status, hostname=w.hostname,
            version=w.version, labels=w.labels or {}, current_runs=w.current_runs,
            max_concurrency=w.max_concurrency,
            last_seen_at=w.last_seen_at.isoformat() if w.last_seen_at else None,
        )
        for w in result.scalars().all()
    ]


@router.post("", response_model=WorkerCreatedResponse, status_code=201)
async def create_worker(
    payload: WorkerCreateRequest,
    auth: AuthContext = Depends(require_permission("worker:write")),
    session: AsyncSession = Depends(get_db),
):
    full_token, prefix, token_hash = generate_worker_token()
    worker = Worker(
        id=new_ulid(),
        organization_id=auth.organization_id,
        name=payload.name,
        token_prefix=prefix,
        token_hash=token_hash,
        max_concurrency=payload.max_concurrency,
        labels=payload.labels,
    )
    session.add(worker)
    await session.flush()
    return WorkerCreatedResponse(id=worker.id, name=worker.name, token=full_token)


@router.post("/groups", response_model=WorkerGroupResponse, status_code=201)
async def create_worker_group(
    payload: WorkerGroupCreate,
    auth: AuthContext = Depends(require_permission("worker:write")),
    session: AsyncSession = Depends(get_db),
):
    group = WorkerGroup(id=new_ulid(), organization_id=auth.organization_id, name=payload.name)
    session.add(group)
    await session.flush()
    for wid in payload.worker_ids:
        session.add(WorkerGroupMember(id=new_ulid(), group_id=group.id, worker_id=wid))
    await session.flush()
    return WorkerGroupResponse(id=group.id, name=group.name, worker_count=len(payload.worker_ids))


@router.get("/groups", response_model=list[WorkerGroupResponse])
async def list_worker_groups(
    auth: AuthContext = Depends(require_permission("worker:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(WorkerGroup).where(WorkerGroup.organization_id == auth.organization_id)
    )
    groups = []
    for g in result.scalars().all():
        members = await session.execute(
            select(WorkerGroupMember).where(WorkerGroupMember.group_id == g.id)
        )
        groups.append(WorkerGroupResponse(id=g.id, name=g.name, worker_count=len(members.scalars().all())))
    return groups
