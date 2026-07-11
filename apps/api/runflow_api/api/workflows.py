"""Workflows API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from runflow_api.deps import get_auth_context, require_permission
from runflow_api.db import get_db
from runflow_api.models import Workflow, WorkflowEdge, WorkflowNode, WorkflowRun
from runflow_api.services.workflow_engine import start_workflow_run
from runflow_api.utils import new_ulid
from runflow_api.core.authorization import AuthContext

router = APIRouter(prefix="/workflows", tags=["workflows"])


class WorkflowNodeCreate(BaseModel):
    job_id: str
    slug: str
    argument_mapping: dict[str, str] = {}
    condition: str | None = None
    position: int = 0


class WorkflowEdgeCreate(BaseModel):
    from_node_id: str
    to_node_id: str


class WorkflowCreate(BaseModel):
    project_id: str
    name: str
    slug: str
    description: str | None = None
    on_failure: str = "stop"
    nodes: list[WorkflowNodeCreate] = Field(default_factory=list)
    edges: list[WorkflowEdgeCreate] = Field(default_factory=list)


class WorkflowResponse(BaseModel):
    id: str
    name: str
    slug: str
    enabled: bool
    on_failure: str
    node_count: int = 0


@router.get("", response_model=list[WorkflowResponse])
async def list_workflows(
    auth: AuthContext = Depends(require_permission("workflow:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Workflow).where(Workflow.organization_id == auth.organization_id)
        .options(selectinload(Workflow.nodes))
    )
    return [
        WorkflowResponse(id=w.id, name=w.name, slug=w.slug, enabled=w.enabled,
                         on_failure=w.on_failure, node_count=len(w.nodes))
        for w in result.scalars().all()
    ]


@router.post("", response_model=WorkflowResponse, status_code=201)
async def create_workflow(
    payload: WorkflowCreate,
    auth: AuthContext = Depends(require_permission("job:write")),
    session: AsyncSession = Depends(get_db),
):
    wf = Workflow(
        id=new_ulid(),
        organization_id=auth.organization_id,
        project_id=payload.project_id,
        name=payload.name,
        slug=payload.slug,
        description=payload.description,
        on_failure=payload.on_failure,
    )
    session.add(wf)
    await session.flush()

    node_id_map: dict[str, str] = {}
    for node in payload.nodes:
        n = WorkflowNode(
            id=new_ulid(), workflow_id=wf.id, job_id=node.job_id,
            slug=node.slug, argument_mapping=node.argument_mapping,
            condition=node.condition, position=node.position,
        )
        session.add(n)
        await session.flush()
        node_id_map[node.slug] = n.id

    for edge in payload.edges:
        session.add(WorkflowEdge(
            id=new_ulid(), workflow_id=wf.id,
            from_node_id=edge.from_node_id, to_node_id=edge.to_node_id,
        ))
    await session.flush()
    return WorkflowResponse(id=wf.id, name=wf.name, slug=wf.slug, enabled=wf.enabled,
                            on_failure=wf.on_failure, node_count=len(payload.nodes))


class WorkflowRunRequest(BaseModel):
    arguments: dict[str, Any] = {}


@router.post("/{workflow_id}/run", status_code=202)
async def run_workflow(
    workflow_id: str,
    payload: WorkflowRunRequest = WorkflowRunRequest(),
    auth: AuthContext = Depends(require_permission("workflow:run")),
    session: AsyncSession = Depends(get_db),
):
    wf_run = await start_workflow_run(
        session, workflow_id, auth.organization_id, arguments=payload.arguments,
    )
    await session.commit()
    return {"workflow_run_id": wf_run.id, "status": wf_run.status}


@router.get("/{workflow_id}/runs")
async def list_workflow_runs(
    workflow_id: str,
    auth: AuthContext = Depends(require_permission("workflow:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(WorkflowRun).where(WorkflowRun.workflow_id == workflow_id).order_by(WorkflowRun.created_at.desc()).limit(50)
    )
    runs = result.scalars().all()
    return [{"id": r.id, "status": r.status, "started_at": r.started_at, "finished_at": r.finished_at} for r in runs]
