"""Phase 2-5 schema extension

Revision ID: 0002
Revises: 0001
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("ansible_config", postgresql.JSONB()))
    op.add_column("jobs", sa.Column("worker_labels", postgresql.JSONB()))
    op.add_column("jobs", sa.Column("worker_group_id", sa.String(26)))
    op.add_column("jobs", sa.Column("worker_id", sa.String(26)))
    op.add_column("jobs", sa.Column("secret_refs", postgresql.JSONB()))
    op.add_column("jobs", sa.Column("credential_refs", postgresql.JSONB()))
    op.add_column("runs", sa.Column("workflow_run_id", sa.String(26)))
    op.add_column("runs", sa.Column("workflow_node_id", sa.String(26)))

    op.create_table(
        "secrets",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("organization_id", sa.String(26), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("scope", sa.String(32)),
        sa.Column("scope_id", sa.String(26)),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("encrypted_value", sa.Text(), nullable=False),
        sa.Column("nonce", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("organization_id", "scope", "scope_id", "name"),
    )
    op.create_table(
        "credentials",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("organization_id", sa.String(26), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("project_id", sa.String(26), sa.ForeignKey("projects.id")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("credential_type", sa.String(32), nullable=False),
        sa.Column("encrypted_data", sa.Text(), nullable=False),
        sa.Column("nonce", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "triggers",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("organization_id", sa.String(26), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("project_id", sa.String(26), sa.ForeignKey("projects.id")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("trigger_type", sa.String(32), nullable=False),
        sa.Column("enabled", sa.Boolean()),
        sa.Column("target_type", sa.String(32)),
        sa.Column("target_id", sa.String(26), nullable=False),
        sa.Column("hook_token", sa.String(64), unique=True),
        sa.Column("config", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "mailboxes",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("organization_id", sa.String(26), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("provider", sa.String(32)),
        sa.Column("config", postgresql.JSONB()),
        sa.Column("credential_id", sa.String(26), sa.ForeignKey("credentials.id")),
        sa.Column("enabled", sa.Boolean()),
        sa.Column("polling_interval", sa.Integer()),
        sa.Column("last_check_at", sa.DateTime(timezone=True)),
        sa.Column("mark_as_read", sa.Boolean()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "email_messages",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("mailbox_id", sa.String(26), sa.ForeignKey("mailboxes.id"), nullable=False),
        sa.Column("provider_message_id", sa.String(512), nullable=False),
        sa.Column("trigger_id", sa.String(26), sa.ForeignKey("triggers.id"), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("mailbox_id", "provider_message_id", "trigger_id"),
    )
    op.create_table(
        "callbacks",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("organization_id", sa.String(26), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("resource_type", sa.String(32), nullable=False),
        sa.Column("resource_id", sa.String(26), nullable=False),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column("auth_type", sa.String(32)),
        sa.Column("auth_config_encrypted", sa.Text()),
        sa.Column("auth_config_nonce", sa.String(64)),
        sa.Column("enabled", sa.Boolean()),
        sa.Column("max_retries", sa.Integer()),
        sa.Column("retry_delay_seconds", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "callback_attempts",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("callback_id", sa.String(26), sa.ForeignKey("callbacks.id"), nullable=False),
        sa.Column("run_id", sa.String(26), sa.ForeignKey("runs.id"), nullable=False),
        sa.Column("status_code", sa.Integer()),
        sa.Column("success", sa.Boolean()),
        sa.Column("error", sa.Text()),
        sa.Column("attempted_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "worker_groups",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("organization_id", sa.String(26), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "worker_group_members",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("group_id", sa.String(26), sa.ForeignKey("worker_groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("worker_id", sa.String(26), sa.ForeignKey("workers.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("group_id", "worker_id"),
    )
    op.create_table(
        "inventories",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("organization_id", sa.String(26), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("project_id", sa.String(26), sa.ForeignKey("projects.id")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("source_type", sa.String(32)),
        sa.Column("content", sa.Text()),
        sa.Column("git_config", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "workflows",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("organization_id", sa.String(26), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("project_id", sa.String(26), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("enabled", sa.Boolean()),
        sa.Column("on_failure", sa.String(32)),
        sa.Column("initial_arguments", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("project_id", "slug"),
    )
    op.create_table(
        "workflow_nodes",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("workflow_id", sa.String(26), sa.ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", sa.String(26), sa.ForeignKey("jobs.id"), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("argument_mapping", postgresql.JSONB()),
        sa.Column("condition", sa.String(512)),
        sa.Column("position", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("workflow_id", "slug"),
    )
    op.create_table(
        "workflow_edges",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("workflow_id", sa.String(26), sa.ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_node_id", sa.String(26), sa.ForeignKey("workflow_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("to_node_id", sa.String(26), sa.ForeignKey("workflow_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "workflow_runs",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("workflow_id", sa.String(26), sa.ForeignKey("workflows.id"), nullable=False),
        sa.Column("organization_id", sa.String(26), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("trigger_id", sa.String(26)),
        sa.Column("status", sa.String(32)),
        sa.Column("arguments", postgresql.JSONB()),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("result", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "workflow_node_runs",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("workflow_run_id", sa.String(26), sa.ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("node_id", sa.String(26), sa.ForeignKey("workflow_nodes.id"), nullable=False),
        sa.Column("run_id", sa.String(26), sa.ForeignKey("runs.id")),
        sa.Column("status", sa.String(32)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "ai_providers",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("organization_id", sa.String(26), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("provider_type", sa.String(32), nullable=False),
        sa.Column("base_url", sa.String(2048)),
        sa.Column("model", sa.String(255), nullable=False),
        sa.Column("encrypted_api_key", sa.Text()),
        sa.Column("api_key_nonce", sa.String(64)),
        sa.Column("enabled", sa.Boolean()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "schedule_locks",
        sa.Column("id", sa.String(26), primary_key=True),
        sa.Column("trigger_id", sa.String(26), sa.ForeignKey("triggers.id"), nullable=False),
        sa.Column("fire_key", sa.String(128), nullable=False),
        sa.Column("locked_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("trigger_id", "fire_key"),
    )


def downgrade() -> None:
    for table in [
        "schedule_locks", "ai_providers", "workflow_node_runs", "workflow_runs",
        "workflow_edges", "workflow_nodes", "workflows", "inventories",
        "worker_group_members", "worker_groups", "callback_attempts", "callbacks",
        "email_messages", "mailboxes", "triggers", "credentials", "secrets",
    ]:
        op.drop_table(table)
    op.drop_column("runs", "workflow_node_id")
    op.drop_column("runs", "workflow_run_id")
    op.drop_column("jobs", "credential_refs")
    op.drop_column("jobs", "secret_refs")
    op.drop_column("jobs", "worker_id")
    op.drop_column("jobs", "worker_group_id")
    op.drop_column("jobs", "worker_labels")
    op.drop_column("jobs", "ansible_config")
