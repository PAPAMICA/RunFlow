"""Run completion notifications (email + Pushover)."""

from __future__ import annotations

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import httpx
from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from runflow_api.config import get_settings
from runflow_api.db import async_session_factory
from runflow_api.models import Job, Run
from runflow_api.schemas import JobNotificationConfig
from runflow_shared import RunStatus

logger = logging.getLogger(__name__)

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"
_jinja = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)

SUCCESS_STATUSES = {RunStatus.SUCCESS}
FAILURE_STATUSES = {RunStatus.FAILED, RunStatus.TIMEOUT, RunStatus.CANCELLED}
TERMINAL_NOTIFY_STATUSES = SUCCESS_STATUSES | FAILURE_STATUSES

STATUS_META = {
    RunStatus.SUCCESS: {
        "label": "Succès",
        "title": "Exécution réussie",
        "message": "Le job s'est terminé avec succès.",
        "color": "#34d399",
        "bg": "rgba(16,185,129,0.15)",
        "border": "rgba(16,185,129,0.35)",
        "emoji": "✅",
    },
    RunStatus.FAILED: {
        "label": "Échec",
        "title": "Exécution en échec",
        "message": "Le job s'est terminé en erreur.",
        "color": "#f87171",
        "bg": "rgba(239,68,68,0.15)",
        "border": "rgba(239,68,68,0.35)",
        "emoji": "❌",
    },
    RunStatus.TIMEOUT: {
        "label": "Timeout",
        "title": "Exécution expirée",
        "message": "Le job a dépassé le délai maximum autorisé.",
        "color": "#fbbf24",
        "bg": "rgba(245,158,11,0.15)",
        "border": "rgba(245,158,11,0.35)",
        "emoji": "⏱️",
    },
    RunStatus.CANCELLED: {
        "label": "Annulé",
        "title": "Exécution annulée",
        "message": "Le job a été annulé avant la fin.",
        "color": "#94a3b8",
        "bg": "rgba(148,163,184,0.15)",
        "border": "rgba(148,163,184,0.35)",
        "emoji": "⏹️",
    },
}


def parse_notification_config(raw: dict | None) -> JobNotificationConfig:
    if not raw:
        return JobNotificationConfig()
    return JobNotificationConfig.model_validate(raw)


def mask_pushover_user_key(user_key: str) -> str:
    if not user_key:
        return ""
    if len(user_key) <= 8:
        return "••••••••"
    return f"{user_key[:4]}…{user_key[-4:]}"


def notification_config_to_response(raw: dict | None) -> dict:
    cfg = parse_notification_config(raw)
    data = cfg.model_dump()
    user_key = cfg.pushover.user_key
    data["pushover"] = {
        "enabled": cfg.pushover.enabled,
        "user_key": mask_pushover_user_key(user_key),
        "app_token": None,
    }
    data["pushover_user_key_set"] = bool(user_key)
    return data


def should_notify(config: JobNotificationConfig, status: str) -> bool:
    if not config.enabled:
        return False
    if status in SUCCESS_STATUSES:
        return config.on_success
    if status in FAILURE_STATUSES:
        return config.on_failure
    return False


def _format_duration(seconds: float | None) -> str:
    if seconds is None:
        return "—"
    if seconds < 60:
        return f"{seconds:.1f}s"
    minutes = int(seconds // 60)
    secs = seconds % 60
    return f"{minutes}m {secs:.0f}s"


def _build_run_url(run_id: str) -> str:
    settings = get_settings()
    return f"{settings.web_base_url}/runs/{run_id}"


def _build_context(job: Job, run: Run | None, *, test: bool = False) -> dict:
    status = run.status if run else RunStatus.SUCCESS
    meta = STATUS_META.get(status, STATUS_META[RunStatus.FAILED])
    run_id = run.id if run else "TEST"
    run_url = _build_run_url(run_id) if run else f"{get_settings().web_base_url}/runs"

    details = [
        {"label": "Job", "value": f"{job.name} ({job.slug})"},
        {"label": "Run ID", "value": run_id},
        {"label": "Statut", "value": status},
    ]
    if run:
        if run.duration_seconds is not None:
            details.append({"label": "Durée", "value": _format_duration(run.duration_seconds)})
        if run.exit_code is not None:
            details.append({"label": "Code sortie", "value": str(run.exit_code)})
        if run.trigger_type:
            details.append({"label": "Déclencheur", "value": run.trigger_type})

    subject_prefix = "[RunFlow] Test" if test else "[RunFlow]"
    subject = f"{subject_prefix} {meta['label']} — {job.name}"

    return {
        "subject": subject,
        "title": "Notification de test" if test else meta["title"],
        "message": "Ceci est une notification de test depuis RunFlow." if test else meta["message"],
        "status_label": "Test" if test else meta["label"],
        "status_color": meta["color"],
        "status_bg": meta["bg"],
        "status_border": meta["border"],
        "details": details,
        "error": None if test else (run.error if run else None),
        "run_url": run_url,
        "job_name": job.name,
        "pushover_title": f"{meta['emoji']} {job.name}" if not test else f"🔔 Test — {job.name}",
        "pushover_message": _build_pushover_plain(job, run, test=test),
    }


def _build_pushover_plain(job: Job, run: Run | None, *, test: bool = False) -> str:
    if test:
        return f"Notification de test pour le job {job.name}."
    status = run.status if run else "unknown"
    lines = [
        f"Job : {job.name} ({job.slug})",
        f"Statut : {status}",
        f"Run : {run.id if run else '—'}",
    ]
    if run and run.duration_seconds is not None:
        lines.append(f"Durée : {_format_duration(run.duration_seconds)}")
    if run and run.exit_code is not None:
        lines.append(f"Code : {run.exit_code}")
    if run and run.error:
        lines.append(f"Erreur : {run.error[:500]}")
    return "\n".join(lines)


def render_email_html(context: dict) -> str:
    template = _jinja.get_template("run_notification.html")
    return template.render(**context)


def render_email_text(context: dict) -> str:
    lines = [
        context["title"],
        "",
        context["message"],
        "",
    ]
    for row in context["details"]:
        lines.append(f"{row['label']}: {row['value']}")
    if context.get("error"):
        lines.extend(["", f"Erreur: {context['error']}"])
    lines.extend(["", f"Voir l'exécution: {context['run_url']}"])
    return "\n".join(lines)


def _send_smtp_sync(recipients: list[str], subject: str, html: str, text: str) -> None:
    settings = get_settings()
    if not settings.smtp_host:
        raise RuntimeError("SMTP non configuré (SMTP_HOST manquant)")
    if not settings.smtp_from:
        raise RuntimeError("SMTP non configuré (SMTP_FROM manquant)")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = ", ".join(recipients)
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    if settings.smtp_use_tls:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
            server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_from, recipients, msg.as_string())
    else:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_from, recipients, msg.as_string())


async def send_email(recipients: list[str], subject: str, html: str, text: str) -> None:
    await asyncio.to_thread(_send_smtp_sync, recipients, subject, html, text)


async def send_pushover(
    user_key: str,
    title: str,
    message: str,
    *,
    url: str | None = None,
    app_token: str | None = None,
) -> None:
    settings = get_settings()
    token = app_token or settings.pushover_app_token
    if not token:
        raise RuntimeError("Pushover non configuré (PUSHOVER_APP_TOKEN manquant)")
    if not user_key:
        raise RuntimeError("Clé utilisateur Pushover manquante")

    data = {
        "token": token,
        "user": user_key,
        "title": title[:250],
        "message": message[:1024],
    }
    if url:
        data["url"] = url
        data["url_title"] = "Voir l'exécution"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post("https://api.pushover.net/1/messages.json", data=data)
    if resp.status_code != 200:
        raise RuntimeError(f"Pushover HTTP {resp.status_code}: {resp.text[:200]}")


async def deliver_notifications_for_job(job: Job, run: Run) -> None:
    config = parse_notification_config(job.notification_config)
    if not should_notify(config, run.status):
        return

    context = _build_context(job, run)
    tasks: list[asyncio.Task[None]] = []

    if config.email.enabled and config.email.recipients:
        recipients = [r.strip() for r in config.email.recipients if r.strip()]
        if recipients:
            html = render_email_html(context)
            text = render_email_text(context)
            tasks.append(
                asyncio.create_task(
                    send_email(recipients, context["subject"], html, text)
                )
            )

    if config.pushover.enabled and config.pushover.user_key:
        tasks.append(
            asyncio.create_task(
                send_pushover(
                    config.pushover.user_key,
                    context["pushover_title"],
                    context["pushover_message"],
                    url=context["run_url"],
                    app_token=config.pushover.app_token,
                )
            )
        )

    for task in tasks:
        try:
            await task
        except Exception:
            logger.exception("Notification delivery failed for run %s", run.id)


async def send_test_notification(job: Job, channel: str) -> tuple[bool, str]:
    config = parse_notification_config(job.notification_config)
    context = _build_context(job, None, test=True)

    try:
        if channel == "email":
            if not config.email.enabled:
                return False, "Les notifications email ne sont pas activées pour ce job"
            recipients = [r.strip() for r in config.email.recipients if r.strip()]
            if not recipients:
                return False, "Aucun destinataire email configuré"
            await send_email(
                recipients,
                context["subject"],
                render_email_html(context),
                render_email_text(context),
            )
            return True, f"Email de test envoyé à {', '.join(recipients)}"

        if channel == "pushover":
            if not config.pushover.enabled:
                return False, "Pushover n'est pas activé pour ce job"
            if not config.pushover.user_key:
                return False, "Clé utilisateur Pushover manquante"
            await send_pushover(
                config.pushover.user_key,
                context["pushover_title"],
                context["pushover_message"],
                url=context["run_url"],
                app_token=config.pushover.app_token,
            )
            return True, "Notification Pushover de test envoyée"

        return False, f"Canal inconnu: {channel}"
    except Exception as exc:
        logger.exception("Test notification failed for job %s channel %s", job.id, channel)
        return False, str(exc)


def schedule_notifications_for_run(run_id: str) -> None:
    asyncio.create_task(_deliver_notifications(run_id))


async def _deliver_notifications(run_id: str) -> None:
    async with async_session_factory() as session:
        result = await session.execute(
            select(Run)
            .where(Run.id == run_id)
            .options(selectinload(Run.job))
        )
        run = result.scalar_one_or_none()
        if not run or not run.job:
            return
        if run.status not in TERMINAL_NOTIFY_STATUSES:
            return
        await deliver_notifications_for_job(run.job, run)
