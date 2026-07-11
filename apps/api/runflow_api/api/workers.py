"""Worker API routes."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from runflow_api.core.result_parser import ResultParseError, parse_result
from runflow_api.core.run_state import is_terminal
from runflow_api.core.secret_redaction import SecretRedactor
from runflow_api.deps import get_worker
from runflow_api.db import get_db
from runflow_api.models import Job, JobFile, Run, Worker
from runflow_api.schemas import (
    WorkerHeartbeatRequest,
    WorkerLogBatch,
    WorkerRegisterRequest,
    WorkerRegisterResponse,
    WorkerResultRequest,
    WorkerRunPayload,
)
from runflow_api.services.credentials import resolve_credentials_for_run
from runflow_api.services.git_auth import resolve_git_config_auth
from runflow_api.services.logs import append_logs
from runflow_api.services.queue import claim_next_run, transition_run
from runflow_api.services.secrets import resolve_secrets_for_run
from runflow_api.utils import generate_worker_token, hash_registration_token, utcnow
from runflow_shared import RunStatus, SourceType, WorkerStatus

router = APIRouter(prefix="/worker", tags=["worker"])


@router.post("/register", response_model=WorkerRegisterResponse)
async def worker_register(
    payload: WorkerRegisterRequest,
    session: AsyncSession = Depends(get_db),
):
    reg_hash = hash_registration_token(payload.registration_token)
    result = await session.execute(
        select(Worker).where(
            Worker.registration_token_hash == reg_hash,
            Worker.status == WorkerStatus.PENDING,
        )
    )
    worker = result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=401, detail="Invalid or expired registration token")

    full_token, prefix, token_hash = generate_worker_token()
    worker.token_prefix = prefix
    worker.token_hash = token_hash
    worker.registration_token_hash = None
    worker.status = WorkerStatus.OFFLINE
    if payload.hostname:
        worker.hostname = payload.hostname
    if payload.name:
        worker.name = payload.name
    session.add(worker)
    await session.flush()
    return WorkerRegisterResponse(worker_id=worker.id, token=full_token)


@router.post("/heartbeat")
async def worker_heartbeat(
    payload: WorkerHeartbeatRequest,
    worker: Worker = Depends(get_worker),
    session: AsyncSession = Depends(get_db),
):
    worker.last_seen_at = utcnow()
    worker.status = WorkerStatus.ONLINE
    worker.hostname = payload.hostname or worker.hostname
    worker.version = payload.version or worker.version
    # Ne pas écraser un claim récent : le worker incrémente _current_runs après le claim.
    worker.current_runs = max(worker.current_runs, payload.current_runs)
    session.add(worker)
    await session.flush()

    cancel_rows = await session.execute(
        select(Run.id).where(
            Run.worker_id == worker.id,
            Run.cancel_requested_at.is_not(None),
            Run.status.in_(
                [RunStatus.ASSIGNED, RunStatus.PREPARING, RunStatus.RUNNING]
            ),
        )
    )
    cancel_run_ids = list(cancel_rows.scalars().all())
    return {"status": "ok", "cancel_run_ids": cancel_run_ids}


@router.post("/claim", response_model=WorkerRunPayload | None)
async def worker_claim(
    worker: Worker = Depends(get_worker),
    session: AsyncSession = Depends(get_db),
):
    if worker.current_runs >= worker.max_concurrency:
        return None

    run = await claim_next_run(session, worker, timeout_seconds=3.0)
    if not run:
        return None

    result = await session.execute(
        select(Job).where(Job.id == run.job_id).options(selectinload(Job.files), selectinload(Job.parameters))
    )
    job = result.scalar_one()

    worker_runs_root = Path("/worker-data/runs")
    run.workspace_path = str(worker_runs_root / run.id)
    session.add(run)
    await session.flush()

    git_cfg = None
    if job.source_type == SourceType.GIT and job.git_config:
        git_cfg = await resolve_git_config_auth(session, job.organization_id, dict(job.git_config))

    overlay_files = [
        {"path": f.path, "content": f.content}
        for f in job.files
        if not f.is_directory and f.content is not None
    ]
    internal_files = [
        {"path": f.path, "content": f.content, "is_directory": f.is_directory}
        for f in job.files
    ] if job.source_type == SourceType.INTERNAL else []

    secrets = await resolve_secrets_for_run(
        session, job.organization_id,
        job_id=job.id, project_id=job.project_id, worker_id=worker.id,
        secret_refs=job.secret_refs,
    )
    credentials = await resolve_credentials_for_run(session, job.credential_refs)
    job_payload = {
        "id": job.id,
        "slug": job.slug,
        "runner_type": job.runner_type,
        "source_type": job.source_type,
        "entrypoint": job.entrypoint,
        "timeout_seconds": job.timeout_seconds,
        "result_parser": job.result_parser,
        "network_mode": job.network_mode,
        "memory_limit_mb": job.memory_limit_mb,
        "cpu_limit": job.cpu_limit,
        "git_config": git_cfg,
        "overlay_files": overlay_files,
        "internal_files": internal_files,
        "ansible_config": job.ansible_config,
        "secrets": secrets,
        "credentials": credentials,
        "parameters": [
            {
                "name": p.name,
                "param_type": p.param_type,
                "position": p.position,
                "label": p.label,
            }
            for p in sorted(job.parameters, key=lambda x: x.position)
        ],
    }

    return WorkerRunPayload(
        run_id=run.id,
        job=job_payload,
        arguments=run.arguments or {},
        workspace_path=run.workspace_path,
        debug=bool(run.debug),
    )


@router.post("/runs/{run_id}/accept")
async def worker_accept_run(
    run_id: str,
    worker: Worker = Depends(get_worker),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(select(Run).where(Run.id == run_id, Run.worker_id == worker.id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    await transition_run(session, run, RunStatus.PREPARING)
    await transition_run(session, run, RunStatus.RUNNING)
    return {"status": run.status}


@router.post("/runs/{run_id}/logs")
async def worker_push_logs(
    run_id: str,
    payload: WorkerLogBatch,
    worker: Worker = Depends(get_worker),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(select(Run).where(Run.id == run_id, Run.worker_id == worker.id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    secret_values = [str(v) for v in (run.arguments or {}).values() if isinstance(v, str)]
    redactor = SecretRedactor(secret_values)
    await append_logs(session, run_id, payload.entries, redactor)
    return {"status": "ok", "count": len(payload.entries)}


@router.post("/runs/{run_id}/result")
async def worker_submit_result(
    run_id: str,
    payload: WorkerResultRequest,
    worker: Worker = Depends(get_worker),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Run).where(Run.id == run_id, Run.worker_id == worker.id).options(selectinload(Run.job))
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if is_terminal(run.status):
        # Already cancelled/failed (e.g. by reaper or user) — ignore late result.
        return {"status": run.status}

    job = run.job
    parsed_result = None
    try:
        parsed_result = parse_result(
            job.result_parser,
            payload.stdout,
            payload.stderr,
            payload.exit_code,
            payload.result_file_content,
        )
    except ResultParseError as exc:
        await transition_run(session, run, RunStatus.FAILED, exit_code=payload.exit_code, error=str(exc))
        return {"status": run.status}

    if payload.exit_code == 0:
        await transition_run(
            session,
            run,
            RunStatus.SUCCESS,
            exit_code=0,
            result=parsed_result,
        )
    else:
        await transition_run(
            session,
            run,
            RunStatus.FAILED,
            exit_code=payload.exit_code,
            result=parsed_result,
            error=payload.error or "Job failed",
        )
    return {"status": run.status, "result": parsed_result}


@router.post("/runs/{run_id}/fail")
async def worker_report_failure(
    run_id: str,
    payload: WorkerResultRequest,
    worker: Worker = Depends(get_worker),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(select(Run).where(Run.id == run_id, Run.worker_id == worker.id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if is_terminal(run.status):
        return {"status": run.status}

    await transition_run(
        session,
        run,
        RunStatus.FAILED,
        exit_code=payload.exit_code,
        error=payload.error or "Worker reported failure",
    )
    return {"status": run.status}


@router.post("/runs/{run_id}/cancelled")
async def worker_report_cancelled(
    run_id: str,
    worker: Worker = Depends(get_worker),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(select(Run).where(Run.id == run_id, Run.worker_id == worker.id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if is_terminal(run.status):
        return {"status": run.status}

    await transition_run(
        session,
        run,
        RunStatus.CANCELLED,
        error="Annulé par l'utilisateur",
    )
    return {"status": run.status}
