"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2026-07-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), unique=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("enabled", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "organization_members",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("organization_id", sa.String(26), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("user_id", sa.String(26), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role", sa.String(32)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("organization_id", "user_id"),
    )
    op.create_table(
        "projects",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("organization_id", sa.String(26), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("organization_id", "slug"),
    )
    op.create_table(
        "api_keys",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("organization_id", sa.String(26), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("prefix", sa.String(32), nullable=False),
        sa.Column("key_hash", sa.String(64), nullable=False),
        sa.Column("scopes", postgresql.JSONB()),
        sa.Column("project_id", sa.String(26), sa.ForeignKey("projects.id")),
        sa.Column("allowed_job_ids", postgresql.JSONB()),
        sa.Column("enabled", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "workers",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("organization_id", sa.String(26), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("token_prefix", sa.String(32), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("hostname", sa.String(255)),
        sa.Column("status", sa.String(32)),
        sa.Column("last_seen_at", sa.DateTime(timezone=True)),
        sa.Column("version", sa.String(64)),
        sa.Column("max_concurrency", sa.Integer(), default=5),
        sa.Column("labels", postgresql.JSONB()),
        sa.Column("current_runs", sa.Integer(), default=0),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "jobs",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("organization_id", sa.String(26), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("project_id", sa.String(26), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("runner_type", sa.String(32)),
        sa.Column("source_type", sa.String(32)),
        sa.Column("entrypoint", sa.String(512)),
        sa.Column("timeout_seconds", sa.Integer()),
        sa.Column("concurrency_limit", sa.Integer()),
        sa.Column("prevent_concurrent_runs", sa.Boolean()),
        sa.Column("result_parser", sa.String(32)),
        sa.Column("network_mode", sa.String(32)),
        sa.Column("memory_limit_mb", sa.Integer()),
        sa.Column("cpu_limit", sa.Float()),
        sa.Column("enabled", sa.Boolean()),
        sa.Column("git_config", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("project_id", "slug"),
    )
    op.create_table(
        "job_files",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("job_id", sa.String(26), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("path", sa.String(1024), nullable=False),
        sa.Column("is_directory", sa.Boolean()),
        sa.Column("content", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("job_id", "path"),
    )
    op.create_table(
        "job_parameters",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("job_id", sa.String(26), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("label", sa.String(255)),
        sa.Column("description", sa.Text()),
        sa.Column("param_type", sa.String(32)),
        sa.Column("required", sa.Boolean()),
        sa.Column("default_value", postgresql.JSONB()),
        sa.Column("options", postgresql.JSONB()),
        sa.Column("validation", postgresql.JSONB()),
        sa.Column("position", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("job_id", "name"),
    )
    op.create_table(
        "runs",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("organization_id", sa.String(26), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("job_id", sa.String(26), sa.ForeignKey("jobs.id"), nullable=False),
        sa.Column("worker_id", sa.String(26), sa.ForeignKey("workers.id")),
        sa.Column("trigger_type", sa.String(32)),
        sa.Column("trigger_id", sa.String(26)),
        sa.Column("arguments", postgresql.JSONB()),
        sa.Column("status", sa.String(32)),
        sa.Column("queued_at", sa.DateTime(timezone=True)),
        sa.Column("assigned_at", sa.DateTime(timezone=True)),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("duration_seconds", sa.Float()),
        sa.Column("exit_code", sa.Integer()),
        sa.Column("result", postgresql.JSONB()),
        sa.Column("error", sa.Text()),
        sa.Column("workspace_path", sa.String(1024)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "run_logs",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("run_id", sa.String(26), sa.ForeignKey("runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True)),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("stream", sa.String(32)),
        sa.Column("message", sa.Text(), nullable=False),
        sa.UniqueConstraint("run_id", "sequence"),
    )
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("organization_id", sa.String(26), sa.ForeignKey("organizations.id")),
        sa.Column("user_id", sa.String(26), sa.ForeignKey("users.id")),
        sa.Column("api_key_id", sa.String(26), sa.ForeignKey("api_keys.id")),
        sa.Column("action", sa.String(128), nullable=False),
        sa.Column("resource_type", sa.String(64)),
        sa.Column("resource_id", sa.String(26)),
        sa.Column("metadata", postgresql.JSONB()),
        sa.Column("ip", sa.String(64)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("run_logs")
    op.drop_table("runs")
    op.drop_table("job_parameters")
    op.drop_table("job_files")
    op.drop_table("jobs")
    op.drop_table("workers")
    op.drop_table("api_keys")
    op.drop_table("projects")
    op.drop_table("organization_members")
    op.drop_table("users")
    op.drop_table("organizations")
