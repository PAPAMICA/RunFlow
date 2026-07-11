"""Worker registration token support

Revision ID: 0003
Revises: 0002
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("workers")}
    if "registration_token_hash" not in columns:
        op.add_column("workers", sa.Column("registration_token_hash", sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column("workers", "registration_token_hash")
