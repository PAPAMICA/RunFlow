"""Workflow DAG execution engine."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from runflow_api.core.condition_evaluator import evaluate_condition
from runflow_api.core.template_engine import render_argument_mapping
from runflow_api.db import async_session_factory
from runflow_api.models import Job, Run, Workflow, WorkflowEdge, WorkflowNode, WorkflowNodeRun, WorkflowRun
from runflow_api.services.queue import enqueue_run
from runflow_api.utils import new_ulid, utcnow
from runflow_shared import RunStatus

logger = logging.getLogger(__name__)


async def start_workflow_run(
    session: AsyncSession,
    workflow_id: str,
    organization_id: str,
    arguments: dict[str, Any] | None = None,
    trigger_id: str | None = None,
) -> WorkflowRun:
    wf_result = await session.execute(
        select(Workflow)
        .where(Workflow.id == workflow_id)
        .options(selectinload(Workflow.nodes), selectinload(Workflow.edges))
    )
    workflow = wf_result.scalar_one_or_none()
    if not workflow or not workflow.enabled:
        raise ValueError("Workflow not found or disabled")

    wf_run = WorkflowRun(
        id=new_ulid(),
        workflow_id=workflow.id,
        organization_id=organization_id,
        trigger_id=trigger_id,
        arguments=arguments or {},
        status=RunStatus.RUNNING,
        started_at=utcnow(),
    )
    session.add(wf_run)
    await session.flush()

    for node in workflow.nodes:
        session.add(
            WorkflowNodeRun(
                id=new_ulid(),
                workflow_run_id=wf_run.id,
                node_id=node.id,
                status=RunStatus.QUEUED,
            )
        )
    await session.flush()
    asyncio.create_task(_process_workflow(wf_run.id))
    return wf_run


async def _process_workflow(workflow_run_id: str) -> None:
    async with async_session_factory() as session:
        await _tick_workflow(session, workflow_run_id)
        await session.commit()


async def _tick_workflow(session: AsyncSession, workflow_run_id: str) -> None:
    wf_run_result = await session.execute(
        select(WorkflowRun)
        .where(WorkflowRun.id == workflow_run_id)
        .options(selectinload(WorkflowRun.node_runs))
    )
    wf_run = wf_run_result.scalar_one_or_none()
    if not wf_run:
        return

    wf_result = await session.execute(
        select(Workflow)
        .where(Workflow.id == wf_run.workflow_id)
        .options(selectinload(Workflow.nodes), selectinload(Workflow.edges))
    )
    workflow = wf_result.scalar_one()

    edges = workflow.edges
    nodes_by_id = {n.id: n for n in workflow.nodes}
    node_runs_by_node = {nr.node_id: nr for nr in wf_run.node_runs}

    # Build job results context
    jobs_context: dict[str, Any] = {}
    for nr in wf_run.node_runs:
        if nr.run_id:
            run_result = await session.execute(select(Run).where(Run.id == nr.run_id))
            run = run_result.scalar_one_or_none()
            if run:
                node = nodes_by_id.get(nr.node_id)
                if node:
                    jobs_context[node.slug] = {
                        "status": run.status,
                        "result": run.result,
                    }

    # Find runnable nodes (all dependencies satisfied)
    for node in workflow.nodes:
        nr = node_runs_by_node.get(node.id)
        if not nr or nr.status != RunStatus.QUEUED:
            continue

        deps = [e.from_node_id for e in edges if e.to_node_id == node.id]
        deps_done = True
        for dep_id in deps:
            dep_nr = node_runs_by_node.get(dep_id)
            if not dep_nr or dep_nr.status not in (RunStatus.SUCCESS, RunStatus.SKIPPED):
                deps_done = False
                break

        if not deps_done:
            continue

        # Check condition
        if node.condition:
            ctx = {"jobs": jobs_context}
            if not evaluate_condition(node.condition, ctx):
                nr.status = RunStatus.SKIPPED
                session.add(nr)
                continue

        # Map arguments and enqueue job run
        context = {"jobs": jobs_context, "workflow": wf_run.arguments}
        args = render_argument_mapping(node.argument_mapping or {}, context) if node.argument_mapping else {}

        job_result = await session.execute(select(Job).where(Job.id == node.job_id))
        job = job_result.scalar_one_or_none()
        if not job:
            nr.status = RunStatus.FAILED
            session.add(nr)
            continue

        run = Run(
            id=new_ulid(),
            organization_id=wf_run.organization_id,
            job_id=job.id,
            trigger_type="workflow",
            trigger_id=wf_run.id,
            arguments=args,
            workflow_run_id=wf_run.id,
            workflow_node_id=node.id,
        )
        await enqueue_run(session, run)
        nr.run_id = run.id
        nr.status = RunStatus.RUNNING
        session.add(nr)

    # Check if workflow is complete
    all_done = all(
        nr.status in (RunStatus.SUCCESS, RunStatus.FAILED, RunStatus.SKIPPED, RunStatus.TIMEOUT)
        for nr in wf_run.node_runs
    )
    if all_done:
        wf_run.status = RunStatus.SUCCESS if all(nr.status == RunStatus.SUCCESS for nr in wf_run.node_runs) else RunStatus.FAILED
        wf_run.finished_at = utcnow()
        session.add(wf_run)
    else:
        # Schedule next tick
        asyncio.create_task(_schedule_next_tick(workflow_run_id))


async def _schedule_next_tick(workflow_run_id: str) -> None:
    await asyncio.sleep(2)
    async with async_session_factory() as session:
        await _tick_workflow(session, workflow_run_id)
        await session.commit()


async def on_run_completed(session: AsyncSession, run: Run) -> None:
    """Called when a run finishes - update workflow node run and tick workflow."""
    if not run.workflow_run_id or not run.workflow_node_id:
        return

    nr_result = await session.execute(
        select(WorkflowNodeRun).where(
            WorkflowNodeRun.workflow_run_id == run.workflow_run_id,
            WorkflowNodeRun.node_id == run.workflow_node_id,
        )
    )
    nr = nr_result.scalar_one_or_none()
    if nr:
        nr.status = run.status
        session.add(nr)
        await session.flush()
        asyncio.create_task(_process_workflow(run.workflow_run_id))
