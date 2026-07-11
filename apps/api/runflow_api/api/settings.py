"""Organization-level settings (SMTP, …)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.config import get_settings
from runflow_api.core.authorization import AuthContext
from runflow_api.db import get_db
from runflow_api.deps import require_permission
from runflow_api.models import Organization
from runflow_api.schemas import (
    SmtpConfigResponse,
    SmtpConfigUpdate,
    SmtpTestRequest,
    SmtpTestResponse,
)
from runflow_api.services.notifications import resolve_smtp_settings, send_email

router = APIRouter(prefix="/settings", tags=["settings"])
logger = logging.getLogger(__name__)


async def _get_org(session: AsyncSession, org_id: str | None) -> Organization:
    if not org_id:
        raise HTTPException(status_code=404, detail="No organization")
    result = await session.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


def _smtp_response(org_smtp: dict | None) -> SmtpConfigResponse:
    if org_smtp:
        return SmtpConfigResponse(
            enabled=bool(org_smtp.get("enabled", False)),
            host=org_smtp.get("host", "") or "",
            port=int(org_smtp.get("port") or 587),
            username=org_smtp.get("username", "") or "",
            from_email=org_smtp.get("from_email", "") or "",
            use_tls=bool(org_smtp.get("use_tls", True)),
            password_set=bool(org_smtp.get("password")),
            source="org",
        )

    settings = get_settings()
    if settings.smtp_host:
        return SmtpConfigResponse(
            enabled=True,
            host=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            from_email=settings.smtp_from,
            use_tls=settings.smtp_use_tls,
            password_set=bool(settings.smtp_password),
            source="env",
        )

    return SmtpConfigResponse(source="none")


@router.get("/smtp", response_model=SmtpConfigResponse)
async def get_smtp_config(
    auth: AuthContext = Depends(require_permission("org:read")),
    session: AsyncSession = Depends(get_db),
):
    org = await _get_org(session, auth.organization_id)
    return _smtp_response(org.smtp_config)


@router.put("/smtp", response_model=SmtpConfigResponse)
async def update_smtp_config(
    payload: SmtpConfigUpdate,
    auth: AuthContext = Depends(require_permission("org:write")),
    session: AsyncSession = Depends(get_db),
):
    org = await _get_org(session, auth.organization_id)
    existing = org.smtp_config or {}

    # Keep the stored password when the client doesn't submit a new one
    # (the UI never receives the plaintext password back).
    password = payload.password if payload.password else existing.get("password", "")

    org.smtp_config = {
        "enabled": payload.enabled,
        "host": payload.host.strip(),
        "port": payload.port,
        "username": payload.username.strip(),
        "password": password,
        "from_email": payload.from_email.strip(),
        "use_tls": payload.use_tls,
    }
    await session.commit()
    return _smtp_response(org.smtp_config)


@router.post("/smtp/test", response_model=SmtpTestResponse)
async def test_smtp_config(
    payload: SmtpTestRequest,
    auth: AuthContext = Depends(require_permission("org:write")),
    session: AsyncSession = Depends(get_db),
):
    org = await _get_org(session, auth.organization_id)
    smtp = resolve_smtp_settings(org.smtp_config)
    if not smtp.configured:
        return SmtpTestResponse(
            success=False,
            message="SMTP non configuré (hôte et adresse d'expéditeur requis).",
        )

    recipient = str(payload.recipient)
    subject = "[RunFlow] Test de configuration SMTP"
    text = (
        "Ceci est un email de test envoyé depuis RunFlow.\n\n"
        "Si vous recevez ce message, votre configuration SMTP fonctionne correctement."
    )
    html = (
        "<div style=\"font-family:sans-serif;line-height:1.5\">"
        "<h2 style=\"margin:0 0 12px\">✅ Test SMTP réussi</h2>"
        "<p>Ceci est un email de test envoyé depuis <strong>RunFlow</strong>.</p>"
        "<p>Si vous recevez ce message, votre configuration SMTP fonctionne correctement.</p>"
        "</div>"
    )
    try:
        await send_email([recipient], subject, html, text, smtp)
    except Exception as exc:  # noqa: BLE001
        logger.exception("SMTP test failed")
        return SmtpTestResponse(success=False, message=str(exc))
    return SmtpTestResponse(success=True, message=f"Email de test envoyé à {recipient}")
