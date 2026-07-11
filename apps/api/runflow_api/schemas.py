"""Pydantic schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    enabled: bool


class OrganizationResponse(BaseModel):
    id: str
    name: str
    slug: str


class ProjectCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None


class ProjectResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    slug: str
    description: str | None = None


class JobParameterCreate(BaseModel):
    name: str
    label: str | None = None
    description: str | None = None
    param_type: str = "string"
    required: bool = False
    default_value: Any | None = None
    options: list[str] | None = None
    validation: dict[str, Any] | None = None
    position: int = 0


class JobParameterResponse(JobParameterCreate):
    id: str


class JobCreate(BaseModel):
    project_id: str
    name: str
    slug: str
    description: str | None = None
    runner_type: str = "python"
    source_type: str = "internal"
    entrypoint: str = "main.py"
    timeout_seconds: int = 300
    concurrency_limit: int = 1
    prevent_concurrent_runs: bool = False
    result_parser: str = "runflow_sdk"
    network_mode: str = "bridge"
    memory_limit_mb: int = 512
    cpu_limit: float = 1.0
    parameters: list[JobParameterCreate] = Field(default_factory=list)


class JobUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    entrypoint: str | None = None
    timeout_seconds: int | None = None
    enabled: bool | None = None
    result_parser: str | None = None


class JobResponse(BaseModel):
    id: str
    organization_id: str
    project_id: str
    name: str
    slug: str
    description: str | None
    runner_type: str
    source_type: str
    entrypoint: str
    timeout_seconds: int
    concurrency_limit: int
    prevent_concurrent_runs: bool
    result_parser: str
    network_mode: str
    memory_limit_mb: int
    cpu_limit: float
    enabled: bool
    parameters: list[JobParameterResponse] = Field(default_factory=list)


class JobFileNode(BaseModel):
    path: str
    is_directory: bool
    content: str | None = None


class JobFileWrite(BaseModel):
    content: str


class JobFileCreate(BaseModel):
    path: str
    is_directory: bool = False
    content: str | None = None


class JobFileRename(BaseModel):
    new_path: str


class RunCreateRequest(BaseModel):
    arguments: dict[str, Any] = Field(default_factory=dict)


class RunResponse(BaseModel):
    id: str
    job_id: str
    worker_id: str | None
    trigger_type: str
    status: str
    arguments: dict[str, Any]
    exit_code: int | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    duration: float | None = Field(None, alias="duration_seconds")
    created_at: datetime
    queued_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None

    model_config = {"populate_by_name": True}


class RunQueuedResponse(BaseModel):
    run_id: str
    status: str


class APIKeyCreate(BaseModel):
    name: str
    scopes: list[str] = Field(default_factory=lambda: ["job:run", "run:read"])
    project_id: str | None = None
    allowed_job_ids: list[str] | None = None


class APIKeyResponse(BaseModel):
    id: str
    name: str
    prefix: str
    scopes: list[str]
    enabled: bool


class APIKeyCreatedResponse(APIKeyResponse):
    key: str


class WorkerHeartbeatRequest(BaseModel):
    hostname: str | None = None
    version: str | None = None
    current_runs: int = 0


class WorkerRegisterRequest(BaseModel):
    registration_token: str
    hostname: str | None = None
    name: str | None = None


class WorkerRegisterResponse(BaseModel):
    worker_id: str
    token: str


class WorkerLogBatch(BaseModel):
    entries: list[dict[str, Any]]


class WorkerResultRequest(BaseModel):
    exit_code: int
    stdout: str = ""
    stderr: str = ""
    result_file_content: str | None = None
    error: str | None = None


class WorkerRunPayload(BaseModel):
    run_id: str
    job: dict[str, Any]
    arguments: dict[str, Any]
    workspace_path: str


class DashboardStats(BaseModel):
    runs_today: int
    success_rate: float
    running_jobs: int
    failed_jobs: int
    online_workers: int


class JobStatsResponse(BaseModel):
    total_runs: int
    success_rate: float
    avg_duration_seconds: float | None
    last_run: RunResponse | None = None
    last_failure: RunResponse | None = None
