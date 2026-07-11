"""Job management routes."""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from runflow_api.core.authorization import AuthContext
from runflow_api.deps import get_auth_context, require_permission
from runflow_api.db import get_db
from runflow_api.models import Job, JobFile, JobParameter, Project, Run
from runflow_api.schemas import (
    GitConfig,
    GitPreviewRequest,
    GitPreviewResponse,
    JobCreate,
    JobFileCreate,
    JobFileNode,
    JobFileRename,
    JobFileWrite,
    JobResponse,
    JobStatsResponse,
    JobUpdate,
    ProjectCreate,
    ProjectResponse,
    RunResponse,
)
from runflow_api.api.runs import _run_to_response
from runflow_api.services.job_files import JobFileStorage
from runflow_api.services.git_preview import build_git_preview
from runflow_api.utils import new_ulid
from runflow_shared import RunStatus

router = APIRouter(tags=["jobs"])
logger = logging.getLogger(__name__)


async def _upsert_env_file(
    session: AsyncSession, job_id: str, content: str | None, storage: JobFileStorage
) -> None:
    """Create, update or remove the overlay .env file for a job."""
    result = await session.execute(
        select(JobFile).where(JobFile.job_id == job_id, JobFile.path == ".env")
    )
    db_file = result.scalar_one_or_none()
    if not content or not content.strip():
        if db_file:
            await session.delete(db_file)
        try:
            storage.delete_path(job_id, ".env")
        except FileNotFoundError:
            pass
        return
    storage.write_file(job_id, ".env", content)
    if db_file:
        db_file.content = content
    else:
        session.add(JobFile(id=new_ulid(), job_id=job_id, path=".env", content=content))


def _job_to_response(job: Job) -> JobResponse:
    has_env = any(f.path == ".env" and f.content for f in job.files)
    git_cfg = None
    if job.git_config:
        safe_cfg = {k: v for k, v in job.git_config.items() if k != "access_token"}
        git_cfg = GitConfig(**safe_cfg)
    return JobResponse(
        id=job.id,
        organization_id=job.organization_id,
        project_id=job.project_id,
        name=job.name,
        slug=job.slug,
        description=job.description,
        runner_type=job.runner_type,
        source_type=job.source_type,
        entrypoint=job.entrypoint,
        timeout_seconds=job.timeout_seconds,
        concurrency_limit=job.concurrency_limit,
        prevent_concurrent_runs=job.prevent_concurrent_runs,
        result_parser=job.result_parser,
        network_mode=job.network_mode,
        memory_limit_mb=job.memory_limit_mb,
        cpu_limit=job.cpu_limit,
        enabled=job.enabled,
        git_config=git_cfg,
        has_env_file=has_env,
        parameters=[
            {
                "id": p.id,
                "name": p.name,
                "label": p.label,
                "description": p.description,
                "param_type": p.param_type,
                "required": p.required,
                "default_value": p.default_value,
                "options": p.options,
                "validation": p.validation,
                "position": p.position,
            }
            for p in sorted(job.parameters, key=lambda x: x.position)
        ],
    )


@router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(
    auth: AuthContext = Depends(require_permission("project:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Project).where(Project.organization_id == auth.organization_id)
    )
    projects = result.scalars().all()
    return [
        ProjectResponse(
            id=p.id, organization_id=p.organization_id, name=p.name, slug=p.slug, description=p.description
        )
        for p in projects
    ]


@router.post("/projects", response_model=ProjectResponse, status_code=201)
async def create_project(
    payload: ProjectCreate,
    auth: AuthContext = Depends(require_permission("project:write")),
    session: AsyncSession = Depends(get_db),
):
    project = Project(
        id=new_ulid(),
        organization_id=auth.organization_id,
        name=payload.name,
        slug=payload.slug,
        description=payload.description,
    )
    session.add(project)
    await session.flush()
    return ProjectResponse(
        id=project.id,
        organization_id=project.organization_id,
        name=project.name,
        slug=project.slug,
        description=project.description,
    )


@router.get("/jobs", response_model=list[JobResponse])
async def list_jobs(
    auth: AuthContext = Depends(require_permission("job:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Job)
        .where(Job.organization_id == auth.organization_id)
        .options(selectinload(Job.parameters), selectinload(Job.files))
        .order_by(Job.name)
    )
    return [_job_to_response(j) for j in result.scalars().all()]


@router.post("/jobs/git-preview", response_model=GitPreviewResponse)
async def preview_git_source(
    payload: GitPreviewRequest,
    auth: AuthContext = Depends(require_permission("job:read")),
):
    del auth
    try:
        preview = await asyncio.to_thread(
            build_git_preview,
            payload.git_config.model_dump(exclude={"access_token"}),
            payload.runner_type,
            payload.entrypoint,
            payload.access_token or payload.git_config.access_token,
        )
    except ValueError as exc:
        logger.warning("git-preview rejected: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return GitPreviewResponse(**preview)


@router.post("/jobs", response_model=JobResponse, status_code=201)
async def create_job(
    payload: JobCreate,
    auth: AuthContext = Depends(require_permission("job:write")),
    session: AsyncSession = Depends(get_db),
):
    project_result = await session.execute(
        select(Project).where(
            Project.id == payload.project_id, Project.organization_id == auth.organization_id
        )
    )
    if not project_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.source_type == "git" and not payload.git_config:
        raise HTTPException(status_code=400, detail="git_config is required for git source jobs")

    job = Job(
        id=new_ulid(),
        organization_id=auth.organization_id,
        project_id=payload.project_id,
        name=payload.name,
        slug=payload.slug,
        description=payload.description,
        runner_type=payload.runner_type,
        source_type=payload.source_type,
        entrypoint=payload.entrypoint,
        timeout_seconds=payload.timeout_seconds,
        concurrency_limit=payload.concurrency_limit,
        prevent_concurrent_runs=payload.prevent_concurrent_runs,
        result_parser=payload.result_parser,
        network_mode=payload.network_mode,
        memory_limit_mb=payload.memory_limit_mb,
        cpu_limit=payload.cpu_limit,
        git_config=payload.git_config.model_dump() if payload.git_config else None,
    )
    session.add(job)
    await session.flush()

    for param in payload.parameters:
        session.add(
            JobParameter(
                id=new_ulid(),
                job_id=job.id,
                name=param.name,
                label=param.label,
                description=param.description,
                param_type=param.param_type,
                required=param.required,
                default_value=param.default_value,
                options=param.options,
                validation=param.validation,
                position=param.position,
            )
        )

    storage = JobFileStorage()
    storage.ensure_job_root(job.id)
    if payload.env_file_content:
        await _upsert_env_file(session, job.id, payload.env_file_content, storage)
    await session.refresh(job, attribute_names=["parameters", "files"])
    return _job_to_response(job)


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    auth: AuthContext = Depends(require_permission("job:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Job)
        .where(Job.id == job_id, Job.organization_id == auth.organization_id)
        .options(selectinload(Job.parameters), selectinload(Job.files))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_response(job)


@router.get("/jobs/{job_id}/stats", response_model=JobStatsResponse)
async def get_job_stats(
    job_id: str,
    auth: AuthContext = Depends(require_permission("job:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Job).where(Job.id == job_id, Job.organization_id == auth.organization_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Job not found")

    total = await session.scalar(select(func.count(Run.id)).where(Run.job_id == job_id)) or 0
    success = await session.scalar(
        select(func.count(Run.id)).where(Run.job_id == job_id, Run.status == RunStatus.SUCCESS)
    ) or 0
    avg_duration = await session.scalar(
        select(func.avg(Run.duration_seconds)).where(
            Run.job_id == job_id, Run.duration_seconds.is_not(None)
        )
    )

    last_run_result = await session.execute(
        select(Run).where(Run.job_id == job_id).order_by(Run.queued_at.desc()).limit(1)
    )
    last_run = last_run_result.scalar_one_or_none()

    last_fail_result = await session.execute(
        select(Run)
        .where(Run.job_id == job_id, Run.status == RunStatus.FAILED)
        .order_by(Run.finished_at.desc())
        .limit(1)
    )
    last_failure = last_fail_result.scalar_one_or_none()

    return JobStatsResponse(
        total_runs=total,
        success_rate=round((success / total * 100) if total else 0.0, 1),
        avg_duration_seconds=float(avg_duration) if avg_duration else None,
        last_run=_run_to_response(last_run) if last_run else None,
        last_failure=_run_to_response(last_failure) if last_failure else None,
    )


@router.get("/jobs/{job_id}/runs", response_model=list[RunResponse])
async def list_job_runs(
    job_id: str,
    auth: AuthContext = Depends(require_permission("run:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Job).where(Job.id == job_id, Job.organization_id == auth.organization_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Job not found")

    runs_result = await session.execute(
        select(Run).where(Run.job_id == job_id).order_by(Run.queued_at.desc()).limit(50)
    )
    return [_run_to_response(r) for r in runs_result.scalars().all()]


@router.patch("/jobs/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: str,
    payload: JobUpdate,
    auth: AuthContext = Depends(require_permission("job:write")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Job)
        .where(Job.id == job_id, Job.organization_id == auth.organization_id)
        .options(selectinload(Job.parameters), selectinload(Job.files))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    storage = JobFileStorage()
    data = payload.model_dump(exclude_unset=True)
    new_parameters = data.pop("parameters", None)
    env_content = data.pop("env_file_content", None)
    if "git_config" in data and data["git_config"] is not None:
        data["git_config"] = GitConfig(**data["git_config"]).model_dump()

    for field, value in data.items():
        setattr(job, field, value)

    if new_parameters is not None:
        for param in list(job.parameters):
            await session.delete(param)
        await session.flush()
        for param in new_parameters:
            session.add(
                JobParameter(
                    id=new_ulid(),
                    job_id=job.id,
                    name=param["name"],
                    label=param.get("label"),
                    description=param.get("description"),
                    param_type=param.get("param_type", "string"),
                    required=param.get("required", False),
                    default_value=param.get("default_value"),
                    options=param.get("options"),
                    validation=param.get("validation"),
                    position=param.get("position", 0),
                )
            )

    if env_content is not None:
        await _upsert_env_file(session, job.id, env_content, storage)

    session.add(job)
    await session.flush()
    await session.refresh(job, attribute_names=["parameters", "files"])
    return _job_to_response(job)


@router.get("/jobs/{job_id}/files", response_model=list[JobFileNode])
async def list_job_files(
    job_id: str,
    auth: AuthContext = Depends(require_permission("job:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Job)
        .where(Job.id == job_id, Job.organization_id == auth.organization_id)
        .options(selectinload(Job.files))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    storage = JobFileStorage()
    if job.source_type == "git":
        nodes: list[JobFileNode] = []
        if job.git_config:
            nodes.append(
                JobFileNode(
                    path="[git]",
                    is_directory=False,
                    content=f"{job.git_config.get('repository_url')} @ {job.git_config.get('branch', 'main')}",
                )
            )
        for f in job.files:
            nodes.append(JobFileNode(path=f.path, is_directory=f.is_directory, content=f.content))
        return nodes

    tree = storage.list_tree(job_id)
    return [JobFileNode(path=n["path"], is_directory=n["is_directory"]) for n in tree]


@router.get("/jobs/{job_id}/files/{file_path:path}", response_model=JobFileNode)
async def get_job_file(
    job_id: str,
    file_path: str,
    auth: AuthContext = Depends(require_permission("job:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Job)
        .where(Job.id == job_id, Job.organization_id == auth.organization_id)
        .options(selectinload(Job.files))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.source_type == "git":
        db_file = next((f for f in job.files if f.path == file_path), None)
        if db_file and db_file.content is not None:
            return JobFileNode(path=file_path, is_directory=False, content=db_file.content)
        raise HTTPException(status_code=404, detail="File not found (git source: overlay files only)")

    storage = JobFileStorage()
    try:
        content = storage.read_file(job_id, file_path)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return JobFileNode(path=file_path, is_directory=False, content=content)


@router.put("/jobs/{job_id}/files/{file_path:path}", response_model=JobFileNode)
async def write_job_file(
    job_id: str,
    file_path: str,
    payload: JobFileWrite,
    auth: AuthContext = Depends(require_permission("job:write")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Job).where(Job.id == job_id, Job.organization_id == auth.organization_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    storage = JobFileStorage()
    try:
        storage.write_file(job_id, file_path, payload.content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    db_result = await session.execute(
        select(JobFile).where(JobFile.job_id == job_id, JobFile.path == file_path)
    )
    db_file = db_result.scalar_one_or_none()
    if db_file:
        db_file.content = payload.content
    else:
        session.add(
            JobFile(id=new_ulid(), job_id=job_id, path=file_path, content=payload.content)
        )
    await session.flush()
    return JobFileNode(path=file_path, is_directory=False, content=payload.content)


@router.post("/jobs/{job_id}/files", response_model=JobFileNode, status_code=201)
async def create_job_file(
    job_id: str,
    payload: JobFileCreate,
    auth: AuthContext = Depends(require_permission("job:write")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Job).where(Job.id == job_id, Job.organization_id == auth.organization_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Job not found")

    storage = JobFileStorage()
    try:
        if payload.is_directory:
            storage.resolve_path(job_id, payload.path).mkdir(parents=True, exist_ok=True)
        else:
            storage.write_file(job_id, payload.path, payload.content or "")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    session.add(
        JobFile(
            id=new_ulid(),
            job_id=job_id,
            path=payload.path,
            is_directory=payload.is_directory,
            content=None if payload.is_directory else (payload.content or ""),
        )
    )
    await session.flush()
    return JobFileNode(
        path=payload.path,
        is_directory=payload.is_directory,
        content=None if payload.is_directory else (payload.content or ""),
    )


@router.delete("/jobs/{job_id}/files/{file_path:path}", status_code=204)
async def delete_job_file(
    job_id: str,
    file_path: str,
    auth: AuthContext = Depends(require_permission("job:write")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Job).where(Job.id == job_id, Job.organization_id == auth.organization_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Job not found")

    storage = JobFileStorage()
    try:
        storage.delete_path(job_id, file_path)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    db_result = await session.execute(
        select(JobFile).where(JobFile.job_id == job_id, JobFile.path == file_path)
    )
    db_file = db_result.scalar_one_or_none()
    if db_file:
        await session.delete(db_file)


@router.post("/jobs/{job_id}/files/{file_path:path}/rename", response_model=JobFileNode)
async def rename_job_file(
    job_id: str,
    file_path: str,
    payload: JobFileRename,
    auth: AuthContext = Depends(require_permission("job:write")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Job).where(Job.id == job_id, Job.organization_id == auth.organization_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Job not found")

    storage = JobFileStorage()
    try:
        storage.rename_path(job_id, file_path, payload.new_path)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    db_result = await session.execute(
        select(JobFile).where(JobFile.job_id == job_id, JobFile.path == file_path)
    )
    db_file = db_result.scalar_one_or_none()
    if db_file:
        db_file.path = payload.new_path
    return JobFileNode(path=payload.new_path, is_directory=False)
