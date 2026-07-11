"""Run management and execution routes."""

from __future__ import annotations

import asyncio
import json
import time
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from runflow_api.config import get_settings
from runflow_api.core.authorization import AuthContext
from runflow_api.core.parameter_validation import ParameterValidationError, validate_job_arguments
from runflow_api.core.run_state import is_terminal
from runflow_api.core.secret_redaction import SecretRedactor
from runflow_api.deps import get_auth_context, require_permission
from runflow_api.db import async_session_factory, get_db
from runflow_api.models import Job, Run
from runflow_api.schemas import RunCreateRequest, RunQueuedResponse, RunResponse
from runflow_api.services.logs import get_logs_after
from runflow_api.services.queue import enqueue_run, transition_run
from runflow_api.services.valkey import (
    RUN_LOG_CHANNEL_PREFIX,
    RUN_STATUS_CHANNEL_PREFIX,
    get_valkey,
    publish_run_status,
)
from runflow_api.utils import new_ulid, utcnow
from runflow_shared import RunStatus, TriggerType

router = APIRouter(tags=["runs"])


def _run_to_response(run: Run, redact: bool = True) -> RunResponse:
    args = run.arguments or {}
    if redact:
        secret_values = [
            str(v) for k, v in args.items() if "secret" in k.lower() or k.endswith("_token")
        ]
        args = SecretRedactor(secret_values).redact_dict(args)
    return RunResponse(
        id=run.id,
        job_id=run.job_id,
        worker_id=run.worker_id,
        trigger_type=run.trigger_type,
        status=run.status,
        arguments=args,
        debug=bool(run.debug),
        exit_code=run.exit_code,
        result=run.result,
        error=run.error,
        duration_seconds=run.duration_seconds,
        created_at=run.created_at,
        queued_at=run.queued_at,
        started_at=run.started_at,
        finished_at=run.finished_at,
    )


@router.get("/runs", response_model=list[RunResponse])
async def list_runs(
    status: str | None = None,
    job_id: str | None = None,
    auth: AuthContext = Depends(require_permission("run:read")),
    session: AsyncSession = Depends(get_db),
):
    stmt = select(Run).where(Run.organization_id == auth.organization_id)
    if status:
        stmt = stmt.where(Run.status == status)
    if job_id:
        stmt = stmt.where(Run.job_id == job_id)
    stmt = stmt.order_by(Run.queued_at.desc()).limit(100)
    result = await session.execute(stmt)
    return [_run_to_response(r) for r in result.scalars().all()]


@router.get("/runs/{run_id}", response_model=RunResponse)
async def get_run(
    run_id: str,
    auth: AuthContext = Depends(require_permission("run:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Run).where(Run.id == run_id, Run.organization_id == auth.organization_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return _run_to_response(run)


@router.post("/runs/{run_id}/cancel", response_model=RunResponse)
async def cancel_run(
    run_id: str,
    auth: AuthContext = Depends(require_permission("job:run")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Run).where(Run.id == run_id, Run.organization_id == auth.organization_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if is_terminal(run.status):
        raise HTTPException(status_code=409, detail="Run already finished")

    if run.status == RunStatus.QUEUED:
        # Not yet claimed by a worker — cancel immediately.
        await transition_run(session, run, RunStatus.CANCELLED, error="Annulé avant exécution")
    else:
        # Claimed/running — request cooperative cancellation; the worker picks
        # this up via its heartbeat and stops the runner container.
        run.cancel_requested_at = utcnow()
        session.add(run)
        await session.flush()
        await publish_run_status(run.id, run.status)
    await session.commit()
    await session.refresh(run)
    return _run_to_response(run)


@router.post("/runs/{run_id}/rerun", response_model=RunQueuedResponse)
async def rerun_run(
    run_id: str,
    response: Response,
    auth: AuthContext = Depends(require_permission("job:run")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Run).where(Run.id == run_id, Run.organization_id == auth.organization_id)
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Run not found")

    job_result = await session.execute(
        select(Job).where(Job.id == source.job_id).options(selectinload(Job.parameters))
    )
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job.enabled:
        raise HTTPException(status_code=400, detail="Job is disabled")
    if not auth.can_run_job(job.id, job.project_id):
        raise HTTPException(status_code=403, detail="Not allowed to run this job")

    if job.prevent_concurrent_runs:
        active = await session.execute(
            select(func.count(Run.id)).where(
                Run.job_id == job.id,
                Run.status.in_(
                    [
                        RunStatus.QUEUED,
                        RunStatus.ASSIGNED,
                        RunStatus.PREPARING,
                        RunStatus.RUNNING,
                    ]
                ),
            )
        )
        if active.scalar_one() > 0:
            raise HTTPException(status_code=409, detail="Job already has an active run")

    try:
        validated_args = validate_job_arguments(
            job.parameters,
            dict(source.arguments or {}),
            forced_arguments=job.forced_arguments or {},
        )
    except ParameterValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors) from exc

    trigger_type = TriggerType.API if auth.api_key_id else TriggerType.MANUAL
    run = Run(
        id=new_ulid(),
        organization_id=auth.organization_id,
        job_id=job.id,
        trigger_type=trigger_type,
        trigger_id=auth.api_key_id or auth.user_id,
        arguments=validated_args,
        debug=bool(source.debug),
    )
    await enqueue_run(session, run)
    await session.commit()
    response.status_code = 202
    return RunQueuedResponse(run_id=run.id, status=run.status)


@router.post("/jobs/{job_slug}/run", response_model=RunQueuedResponse | RunResponse)
async def run_job(
    job_slug: str,
    payload: RunCreateRequest,
    request: Request,
    response: Response,
    wait: bool = Query(default=False),
    wait_timeout: int = Query(default=120, ge=1, le=600),
    auth: AuthContext = Depends(get_auth_context),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Job)
        .where(Job.slug == job_slug, Job.organization_id == auth.organization_id)
        .options(selectinload(Job.parameters))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job.enabled:
        raise HTTPException(status_code=400, detail="Job is disabled")
    if not auth.can_run_job(job.id, job.project_id):
        raise HTTPException(status_code=403, detail="Not allowed to run this job")

    if job.prevent_concurrent_runs:
        active = await session.execute(
            select(func.count(Run.id)).where(
                Run.job_id == job.id,
                Run.status.in_(
                    [
                        RunStatus.QUEUED,
                        RunStatus.ASSIGNED,
                        RunStatus.PREPARING,
                        RunStatus.RUNNING,
                    ]
                ),
            )
        )
        if active.scalar_one() > 0:
            raise HTTPException(status_code=409, detail="Job already has an active run")

    try:
        validated_args = validate_job_arguments(
            job.parameters,
            payload.arguments,
            forced_arguments=job.forced_arguments or {},
        )
    except ParameterValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors) from exc

    trigger_type = TriggerType.API if auth.api_key_id else TriggerType.MANUAL
    run = Run(
        id=new_ulid(),
        organization_id=auth.organization_id,
        job_id=job.id,
        trigger_type=trigger_type,
        trigger_id=auth.api_key_id or auth.user_id,
        arguments=validated_args,
        debug=payload.debug,
    )
    await enqueue_run(session, run)
    await session.commit()
    run_id = run.id

    if not wait:
        response.status_code = 202
        return RunQueuedResponse(run_id=run_id, status=run.status)

    deadline = time.monotonic() + wait_timeout
    while time.monotonic() < deadline:
        async with async_session_factory() as poll_session:
            result = await poll_session.execute(select(Run).where(Run.id == run_id))
            polled = result.scalar_one()
        if is_terminal(polled.status):
            response.status_code = 200
            return _run_to_response(polled)
        await asyncio.sleep(0.5)

    async with async_session_factory() as poll_session:
        result = await poll_session.execute(select(Run).where(Run.id == run_id))
        polled = result.scalar_one()
    response.status_code = 202
    return RunQueuedResponse(run_id=polled.id, status=polled.status)


@router.get("/runs/{run_id}/logs/stream")
async def stream_run_logs(
    run_id: str,
    request: Request,
    auth: AuthContext = Depends(require_permission("run:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Run).where(Run.id == run_id, Run.organization_id == auth.organization_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    last_event_id = request.headers.get("Last-Event-ID")
    after_sequence = int(last_event_id) if last_event_id and last_event_id.isdigit() else 0

    async def event_generator():
        nonlocal after_sequence

        # Subscribe BEFORE reading history so no log published during the
        # historical fetch is lost (they'll be de-duplicated by sequence).
        client = await get_valkey()
        pubsub = client.pubsub()
        await pubsub.subscribe(f"{RUN_LOG_CHANNEL_PREFIX}{run_id}", f"{RUN_STATUS_CHANNEL_PREFIX}{run_id}")

        try:
            historical = await get_logs_after(session, run_id, after_sequence)
            for log in historical:
                after_sequence = log.sequence
                yield f"id: {log.sequence}\nevent: log\ndata: {json.dumps({'sequence': log.sequence, 'stream': log.stream, 'message': log.message, 'timestamp': log.timestamp.isoformat()})}\n\n"

            yield f"event: status\ndata: {json.dumps({'status': run.status})}\n\n"

            if is_terminal(run.status):
                yield f"event: done\ndata: {json.dumps({'status': run.status})}\n\n"
                return

            last_ping = time.monotonic()
            terminal_status: str | None = None
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message.get("type") == "message":
                    channel = message["channel"]
                    data = json.loads(message["data"])
                    if channel.startswith(RUN_LOG_CHANNEL_PREFIX):
                        seq = data.get("sequence", 0)
                        if seq > after_sequence:
                            after_sequence = seq
                            yield f"id: {seq}\nevent: log\ndata: {json.dumps(data)}\n\n"
                    elif channel.startswith(RUN_STATUS_CHANNEL_PREFIX):
                        yield f"event: status\ndata: {json.dumps(data)}\n\n"
                        if is_terminal(data.get("status", "")):
                            terminal_status = data.get("status")
                            break
                    last_ping = time.monotonic()
                else:
                    # Keep the connection alive through idle periods so proxies
                    # (nginx, load balancers) don't drop it during long steps.
                    if time.monotonic() - last_ping >= 15:
                        yield ": ping\n\n"
                        last_ping = time.monotonic()

                try:
                    await session.refresh(run)
                except Exception:
                    # Never let a transient DB hiccup kill the stream.
                    pass
                if is_terminal(run.status):
                    terminal_status = run.status
                    break
                await asyncio.sleep(0.1)

            # The final logs may still be committing when the status flips to a
            # terminal state. Give writes a beat to land, then drain everything
            # left in the DB so no trailing log is lost before we close.
            await asyncio.sleep(0.3)
            trailing = await get_logs_after(session, run_id, after_sequence)
            for log in trailing:
                after_sequence = log.sequence
                yield f"id: {log.sequence}\nevent: log\ndata: {json.dumps({'sequence': log.sequence, 'stream': log.stream, 'message': log.message, 'timestamp': log.timestamp.isoformat()})}\n\n"

            yield f"event: done\ndata: {json.dumps({'status': terminal_status or run.status})}\n\n"
        finally:
            await pubsub.unsubscribe()
            await pubsub.aclose()

    return StreamingResponse(event_generator(), media_type="text/event-stream")
