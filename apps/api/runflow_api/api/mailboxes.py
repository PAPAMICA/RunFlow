"""Mailboxes API."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.deps import require_permission
from runflow_api.db import get_db
from runflow_api.models import Mailbox
from runflow_api.utils import new_ulid
from runflow_api.core.authorization import AuthContext

router = APIRouter(prefix="/mailboxes", tags=["mailboxes"])


class MailboxCreate(BaseModel):
    name: str
    provider: str = "imap"
    config: dict[str, Any] = {}
    credential_id: str | None = None
    polling_interval: int = 60
    mark_as_read: bool = False


class MailboxResponse(BaseModel):
    id: str
    name: str
    provider: str
    enabled: bool
    polling_interval: int


@router.get("", response_model=list[MailboxResponse])
async def list_mailboxes(
    auth: AuthContext = Depends(require_permission("job:read")),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Mailbox).where(Mailbox.organization_id == auth.organization_id)
    )
    return [MailboxResponse(id=m.id, name=m.name, provider=m.provider, enabled=m.enabled,
                            polling_interval=m.polling_interval) for m in result.scalars().all()]


@router.post("", response_model=MailboxResponse, status_code=201)
async def create_mailbox(
    payload: MailboxCreate,
    auth: AuthContext = Depends(require_permission("job:write")),
    session: AsyncSession = Depends(get_db),
):
    mailbox = Mailbox(
        id=new_ulid(), organization_id=auth.organization_id,
        name=payload.name, provider=payload.provider, config=payload.config,
        credential_id=payload.credential_id, polling_interval=payload.polling_interval,
        mark_as_read=payload.mark_as_read,
    )
    session.add(mailbox)
    await session.flush()
    return MailboxResponse(id=mailbox.id, name=mailbox.name, provider=mailbox.provider,
                           enabled=mailbox.enabled, polling_interval=mailbox.polling_interval)
