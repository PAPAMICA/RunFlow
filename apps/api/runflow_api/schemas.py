"""Pydantic schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1)


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


class GitConfig(BaseModel):
    repository_url: str
    branch: str = "main"
    path: str = ""
    username: str | None = None
    access_token: str | None = None
    credential_id: str | None = None


class GitPreviewRequest(BaseModel):
    git_config: GitConfig
    runner_type: str = "python"
    entrypoint: str | None = None
    access_token: str | None = None


class GitPreviewFile(BaseModel):
    path: str
    is_directory: bool


class GitPreviewResponse(BaseModel):
    files: list[GitPreviewFile] = Field(default_factory=list)
    env_example_path: str | None = None
    env_example_content: str | None = None
    suggested_entrypoints: list[str] = Field(default_factory=list)
    detected_parameters: list[JobParameterCreate] = Field(default_factory=list)
    entrypoint: str | None = None


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
    git_config: GitConfig | None = None
    env_file_content: str | None = None
    parameters: list[JobParameterCreate] = Field(default_factory=list)


class JobUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    entrypoint: str | None = None
    source_type: str | None = None
    runner_type: str | None = None
    git_config: GitConfig | None = None
    env_file_content: str | None = None
    timeout_seconds: int | None = None
    concurrency_limit: int | None = None
    prevent_concurrent_runs: bool | None = None
    network_mode: str | None = None
    memory_limit_mb: int | None = None
    cpu_limit: float | None = None
    enabled: bool | None = None
    result_parser: str | None = None
    parameters: list[JobParameterCreate] | None = None
    notification_config: "JobNotificationConfig | None" = None
    forced_arguments: dict[str, Any] | None = None


class EmailNotificationConfig(BaseModel):
    enabled: bool = False
    recipients: list[str] = Field(default_factory=list)


class PushoverNotificationConfig(BaseModel):
    enabled: bool = False
    user_key: str = ""
    app_token: str | None = None


class JobNotificationConfig(BaseModel):
    enabled: bool = False
    on_success: bool = True
    on_failure: bool = True
    email: EmailNotificationConfig = Field(default_factory=EmailNotificationConfig)
    pushover: PushoverNotificationConfig = Field(default_factory=PushoverNotificationConfig)


class JobNotificationConfigResponse(BaseModel):
    enabled: bool = False
    on_success: bool = True
    on_failure: bool = True
    email: EmailNotificationConfig = Field(default_factory=EmailNotificationConfig)
    pushover: PushoverNotificationConfig = Field(default_factory=PushoverNotificationConfig)
    pushover_user_key_set: bool = False


class NotificationTestRequest(BaseModel):
    channel: Literal["email", "pushover"]


class NotificationTestResponse(BaseModel):
    channel: str
    success: bool
    message: str


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
    git_config: GitConfig | None = None
    has_env_file: bool = False
    forced_arguments: dict[str, Any] = Field(default_factory=dict)
    notification_config: JobNotificationConfigResponse | None = None
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
    debug: bool = False


class RunResponse(BaseModel):
    id: str
    job_id: str
    worker_id: str | None
    trigger_type: str
    status: str
    arguments: dict[str, Any]
    debug: bool = False
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
    debug: bool = False


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
