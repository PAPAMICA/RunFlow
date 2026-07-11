"""SQLAlchemy models."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from runflow_api.db import Base
from runflow_api.utils import new_ulid, utcnow
from runflow_shared import (
    LogStream,
    NetworkMode,
    ParameterType,
    ResultParser,
    RunStatus,
    RunnerType,
    SourceType,
    TriggerType,
    UserRole,
    WorkerStatus,
)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

    projects: Mapped[list[Project]] = relationship(back_populates="organization")
    members: Mapped[list[OrganizationMember]] = relationship(back_populates="organization")


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    memberships: Mapped[list[OrganizationMember]] = relationship(back_populates="user")


class OrganizationMember(Base, TimestampMixin):
    __tablename__ = "organization_members"
    __table_args__ = (UniqueConstraint("organization_id", "user_id"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default=UserRole.OWNER)

    organization: Mapped[Organization] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")


class Project(Base, TimestampMixin):
    __tablename__ = "projects"
    __table_args__ = (UniqueConstraint("organization_id", "slug"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    organization: Mapped[Organization] = relationship(back_populates="projects")
    jobs: Mapped[list[Job]] = relationship(back_populates="project")


class APIKey(Base, TimestampMixin):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    prefix: Mapped[str] = mapped_column(String(32), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    scopes: Mapped[list[str]] = mapped_column(JSONB, default=list)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"))
    allowed_job_ids: Mapped[list[str] | None] = mapped_column(JSONB)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class Job(Base, TimestampMixin):
    __tablename__ = "jobs"
    __table_args__ = (UniqueConstraint("project_id", "slug"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    runner_type: Mapped[str] = mapped_column(String(32), default=RunnerType.PYTHON)
    source_type: Mapped[str] = mapped_column(String(32), default=SourceType.INTERNAL)
    entrypoint: Mapped[str] = mapped_column(String(512), default="main.py")
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=300)
    concurrency_limit: Mapped[int] = mapped_column(Integer, default=1)
    prevent_concurrent_runs: Mapped[bool] = mapped_column(Boolean, default=False)
    result_parser: Mapped[str] = mapped_column(String(32), default=ResultParser.RUNFLOW_SDK)
    network_mode: Mapped[str] = mapped_column(String(32), default=NetworkMode.BRIDGE)
    memory_limit_mb: Mapped[int] = mapped_column(Integer, default=512)
    cpu_limit: Mapped[float] = mapped_column(default=1.0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    git_config: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    ansible_config: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    worker_labels: Mapped[dict[str, str] | None] = mapped_column(JSONB)
    worker_group_id: Mapped[str | None] = mapped_column(String(26))
    worker_id: Mapped[str | None] = mapped_column(String(26))
    secret_refs: Mapped[list[str] | None] = mapped_column(JSONB)
    credential_refs: Mapped[list[str] | None] = mapped_column(JSONB)

    project: Mapped[Project] = relationship(back_populates="jobs")
    parameters: Mapped[list[JobParameter]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )
    files: Mapped[list[JobFile]] = relationship(back_populates="job", cascade="all, delete-orphan")
    runs: Mapped[list[Run]] = relationship(back_populates="job")


class JobFile(Base, TimestampMixin):
    __tablename__ = "job_files"
    __table_args__ = (UniqueConstraint("job_id", "path"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    path: Mapped[str] = mapped_column(String(1024), nullable=False)
    is_directory: Mapped[bool] = mapped_column(Boolean, default=False)
    content: Mapped[str | None] = mapped_column(Text)

    job: Mapped[Job] = relationship(back_populates="files")


class JobParameter(Base, TimestampMixin):
    __tablename__ = "job_parameters"
    __table_args__ = (UniqueConstraint("job_id", "name"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    label: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    param_type: Mapped[str] = mapped_column(String(32), default=ParameterType.STRING)
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    default_value: Mapped[Any | None] = mapped_column(JSONB)
    options: Mapped[list[str] | None] = mapped_column(JSONB)
    validation: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    position: Mapped[int] = mapped_column(Integer, default=0)

    job: Mapped[Job] = relationship(back_populates="parameters")


class Worker(Base, TimestampMixin):
    __tablename__ = "workers"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    token_prefix: Mapped[str] = mapped_column(String(32), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    hostname: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default=WorkerStatus.OFFLINE)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[str | None] = mapped_column(String(64))
    max_concurrency: Mapped[int] = mapped_column(Integer, default=5)
    labels: Mapped[dict[str, str]] = mapped_column(JSONB, default=dict)
    current_runs: Mapped[int] = mapped_column(Integer, default=0)
    registration_token_hash: Mapped[str | None] = mapped_column(String(64))

    runs: Mapped[list[Run]] = relationship(back_populates="worker")


class Run(Base, TimestampMixin):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), nullable=False)
    worker_id: Mapped[str | None] = mapped_column(ForeignKey("workers.id"))
    trigger_type: Mapped[str] = mapped_column(String(32), default=TriggerType.MANUAL)
    trigger_id: Mapped[str | None] = mapped_column(String(26))
    arguments: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    status: Mapped[str] = mapped_column(String(32), default=RunStatus.QUEUED)
    queued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[float | None] = mapped_column()
    exit_code: Mapped[int | None] = mapped_column(Integer)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    error: Mapped[str | None] = mapped_column(Text)
    workspace_path: Mapped[str | None] = mapped_column(String(1024))
    workflow_run_id: Mapped[str | None] = mapped_column(String(26))
    workflow_node_id: Mapped[str | None] = mapped_column(String(26))

    job: Mapped[Job] = relationship(back_populates="runs")
    worker: Mapped[Worker | None] = relationship(back_populates="runs")
    logs: Mapped[list[RunLog]] = relationship(back_populates="run", cascade="all, delete-orphan")


class RunLog(Base):
    __tablename__ = "run_logs"
    __table_args__ = (UniqueConstraint("run_id", "sequence"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    stream: Mapped[str] = mapped_column(String(32), default=LogStream.STDOUT)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    run: Mapped[Run] = relationship(back_populates="logs")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    organization_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"))
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    api_key_id: Mapped[str | None] = mapped_column(ForeignKey("api_keys.id"))
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    resource_type: Mapped[str | None] = mapped_column(String(64))
    resource_id: Mapped[str | None] = mapped_column(String(26))
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB)
    ip: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Secret(Base, TimestampMixin):
    __tablename__ = "secrets"
    __table_args__ = (UniqueConstraint("organization_id", "scope", "scope_id", "name"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    scope: Mapped[str] = mapped_column(String(32), default="organization")
    scope_id: Mapped[str | None] = mapped_column(String(26))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    encrypted_value: Mapped[str] = mapped_column(Text, nullable=False)
    nonce: Mapped[str] = mapped_column(String(64), nullable=False)


class Credential(Base, TimestampMixin):
    __tablename__ = "credentials"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    credential_type: Mapped[str] = mapped_column(String(32), nullable=False)
    encrypted_data: Mapped[str] = mapped_column(Text, nullable=False)
    nonce: Mapped[str] = mapped_column(String(64), nullable=False)


class Trigger(Base, TimestampMixin):
    __tablename__ = "triggers"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(32), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    target_type: Mapped[str] = mapped_column(String(32), default="job")
    target_id: Mapped[str] = mapped_column(String(26), nullable=False)
    hook_token: Mapped[str | None] = mapped_column(String(64), unique=True)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)


class Mailbox(Base, TimestampMixin):
    __tablename__ = "mailboxes"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(String(32), default="imap")
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    credential_id: Mapped[str | None] = mapped_column(ForeignKey("credentials.id"))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    polling_interval: Mapped[int] = mapped_column(Integer, default=60)
    last_check_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    mark_as_read: Mapped[bool] = mapped_column(Boolean, default=False)


class EmailMessage(Base):
    __tablename__ = "email_messages"
    __table_args__ = (UniqueConstraint("mailbox_id", "provider_message_id", "trigger_id"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    mailbox_id: Mapped[str] = mapped_column(ForeignKey("mailboxes.id"), nullable=False)
    provider_message_id: Mapped[str] = mapped_column(String(512), nullable=False)
    trigger_id: Mapped[str] = mapped_column(ForeignKey("triggers.id"), nullable=False)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Callback(Base, TimestampMixin):
    __tablename__ = "callbacks"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(32), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(26), nullable=False)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    auth_type: Mapped[str] = mapped_column(String(32), default="none")
    auth_config_encrypted: Mapped[str | None] = mapped_column(Text)
    auth_config_nonce: Mapped[str | None] = mapped_column(String(64))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    max_retries: Mapped[int] = mapped_column(Integer, default=3)
    retry_delay_seconds: Mapped[int] = mapped_column(Integer, default=30)


class CallbackAttempt(Base):
    __tablename__ = "callback_attempts"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    callback_id: Mapped[str] = mapped_column(ForeignKey("callbacks.id"), nullable=False)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id"), nullable=False)
    status_code: Mapped[int | None] = mapped_column(Integer)
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[str | None] = mapped_column(Text)
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class WorkerGroup(Base, TimestampMixin):
    __tablename__ = "worker_groups"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)


class WorkerGroupMember(Base):
    __tablename__ = "worker_group_members"
    __table_args__ = (UniqueConstraint("group_id", "worker_id"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    group_id: Mapped[str] = mapped_column(ForeignKey("worker_groups.id", ondelete="CASCADE"), nullable=False)
    worker_id: Mapped[str] = mapped_column(ForeignKey("workers.id", ondelete="CASCADE"), nullable=False)


class Inventory(Base, TimestampMixin):
    __tablename__ = "inventories"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), default="internal")
    content: Mapped[str | None] = mapped_column(Text)
    git_config: Mapped[dict[str, Any] | None] = mapped_column(JSONB)


class Workflow(Base, TimestampMixin):
    __tablename__ = "workflows"
    __table_args__ = (UniqueConstraint("project_id", "slug"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    on_failure: Mapped[str] = mapped_column(String(32), default="stop")
    initial_arguments: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    nodes: Mapped[list["WorkflowNode"]] = relationship(back_populates="workflow", cascade="all, delete-orphan")
    edges: Mapped[list["WorkflowEdge"]] = relationship(back_populates="workflow", cascade="all, delete-orphan")


class WorkflowNode(Base, TimestampMixin):
    __tablename__ = "workflow_nodes"
    __table_args__ = (UniqueConstraint("workflow_id", "slug"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    workflow_id: Mapped[str] = mapped_column(ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    argument_mapping: Mapped[dict[str, str]] = mapped_column(JSONB, default=dict)
    condition: Mapped[str | None] = mapped_column(String(512))
    position: Mapped[int] = mapped_column(Integer, default=0)

    workflow: Mapped[Workflow] = relationship(back_populates="nodes")


class WorkflowEdge(Base, TimestampMixin):
    __tablename__ = "workflow_edges"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    workflow_id: Mapped[str] = mapped_column(ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    from_node_id: Mapped[str] = mapped_column(ForeignKey("workflow_nodes.id", ondelete="CASCADE"), nullable=False)
    to_node_id: Mapped[str] = mapped_column(ForeignKey("workflow_nodes.id", ondelete="CASCADE"), nullable=False)

    workflow: Mapped[Workflow] = relationship(back_populates="edges")


class WorkflowRun(Base, TimestampMixin):
    __tablename__ = "workflow_runs"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    workflow_id: Mapped[str] = mapped_column(ForeignKey("workflows.id"), nullable=False)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    trigger_id: Mapped[str | None] = mapped_column(String(26))
    status: Mapped[str] = mapped_column(String(32), default=RunStatus.QUEUED)
    arguments: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    node_runs: Mapped[list["WorkflowNodeRun"]] = relationship(back_populates="workflow_run", cascade="all, delete-orphan")


class WorkflowNodeRun(Base, TimestampMixin):
    __tablename__ = "workflow_node_runs"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    workflow_run_id: Mapped[str] = mapped_column(ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False)
    node_id: Mapped[str] = mapped_column(ForeignKey("workflow_nodes.id"), nullable=False)
    run_id: Mapped[str | None] = mapped_column(ForeignKey("runs.id"))
    status: Mapped[str] = mapped_column(String(32), default=RunStatus.QUEUED)

    workflow_run: Mapped[WorkflowRun] = relationship(back_populates="node_runs")


class AIProvider(Base, TimestampMixin):
    __tablename__ = "ai_providers"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_type: Mapped[str] = mapped_column(String(32), nullable=False)
    base_url: Mapped[str | None] = mapped_column(String(2048))
    model: Mapped[str] = mapped_column(String(255), nullable=False)
    encrypted_api_key: Mapped[str | None] = mapped_column(Text)
    api_key_nonce: Mapped[str | None] = mapped_column(String(64))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class ScheduleLock(Base):
    __tablename__ = "schedule_locks"
    __table_args__ = (UniqueConstraint("trigger_id", "fire_key"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_ulid)
    trigger_id: Mapped[str] = mapped_column(ForeignKey("triggers.id"), nullable=False)
    fire_key: Mapped[str] = mapped_column(String(128), nullable=False)
    locked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
