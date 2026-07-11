"""Audit log service."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.models import AuditLog
from runflow_api.utils import new_ulid


async def audit(
    session: AsyncSession,
    action: str,
    *,
    organization_id: str | None = None,
    user_id: str | None = None,
    api_key_id: str | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    metadata: dict | None = None,
    ip: str | None = None,
) -> None:
    entry = AuditLog(
        id=new_ulid(),
        organization_id=organization_id,
        user_id=user_id,
        api_key_id=api_key_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata_=metadata,
        ip=ip,
    )
    session.add(entry)
