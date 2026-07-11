"""IMAP email provider and poller."""

from __future__ import annotations

import email
import imaplib
import logging
import re
from email.header import decode_header
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.db import async_session_factory
from runflow_api.models import EmailMessage, Mailbox, Trigger
from runflow_api.services.credentials import get_credential_data
from runflow_api.services.triggers import fire_trigger
from runflow_api.utils import new_ulid, utcnow
from runflow_shared import TriggerType

logger = logging.getLogger(__name__)


def _decode_header_value(value: str | None) -> str:
    if not value:
        return ""
    parts = decode_header(value)
    result = []
    for part, charset in parts:
        if isinstance(part, bytes):
            result.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            result.append(str(part))
    return "".join(result)


def _match_conditions(msg_data: dict, conditions: dict) -> bool:
    operator = conditions.get("operator", "AND")
    rules = conditions.get("conditions", [])
    results = []
    for rule in rules:
        field = rule.get("field", "").upper()
        op = rule.get("operator", "contains")
        value = rule.get("value", "")
        actual = msg_data.get(field.lower(), "")
        if op == "equals":
            results.append(str(actual) == value)
        elif op == "not_equals":
            results.append(str(actual) != value)
        elif op == "contains":
            results.append(value.lower() in str(actual).lower())
        elif op == "not_contains":
            results.append(value.lower() not in str(actual).lower())
        elif op == "starts_with":
            results.append(str(actual).lower().startswith(value.lower()))
        elif op == "ends_with":
            results.append(str(actual).lower().endswith(value.lower()))
        elif op == "regex":
            results.append(bool(re.search(value, str(actual), re.I)))
        elif op == "exists":
            results.append(bool(actual))
    if operator == "OR":
        return any(results)
    return all(results) if results else False


async def poll_mailboxes() -> int:
    processed = 0
    async with async_session_factory() as session:
        result = await session.execute(
            select(Mailbox).where(Mailbox.enabled.is_(True), Mailbox.provider == "imap")
        )
        mailboxes = result.scalars().all()
        for mailbox in mailboxes:
            try:
                count = await _poll_mailbox(session, mailbox)
                processed += count
                mailbox.last_check_at = utcnow()
                session.add(mailbox)
            except Exception:
                logger.exception("Failed to poll mailbox %s", mailbox.id)
        await session.commit()
    return processed


async def _poll_mailbox(session: AsyncSession, mailbox: Mailbox) -> int:
    config = mailbox.config or {}
    cred_data = {}
    if mailbox.credential_id:
        cred_data = await get_credential_data(session, mailbox.credential_id)

    host = config.get("host", cred_data.get("host", ""))
    port = config.get("port", cred_data.get("port", 993))
    username = cred_data.get("username", config.get("username", ""))
    password = cred_data.get("password", config.get("password", ""))
    folder = config.get("folder", "INBOX")

    mail = imaplib.IMAP4_SSL(host, port)
    mail.login(username, password)
    mail.select(folder)

    _, data = mail.search(None, "UNSEEN")
    msg_ids = data[0].split() if data[0] else []
    processed = 0

    trigger_result = await session.execute(
        select(Trigger).where(Trigger.trigger_type == TriggerType.EMAIL, Trigger.enabled.is_(True))
    )
    triggers = [t for t in trigger_result.scalars().all() if (t.config or {}).get("mailbox_id") == mailbox.id]

    for msg_id in msg_ids[-20:]:
        _, msg_data = mail.fetch(msg_id, "(RFC822)")
        raw = msg_data[0][1]
        msg = email.message_from_bytes(raw)
        message_id = msg.get("Message-ID", str(msg_id))
        from_addr = _decode_header_value(msg.get("From"))
        subject = _decode_header_value(msg.get("Subject"))
        body_text = ""
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    body_text = part.get_payload(decode=True).decode("utf-8", errors="replace")
                    break
        else:
            body_text = msg.get_payload(decode=True).decode("utf-8", errors="replace")

        email_ctx = {
            "from": from_addr,
            "to": _decode_header_value(msg.get("To")),
            "subject": subject,
            "body": body_text,
            "body_text": body_text,
            "message_id": message_id,
        }

        for trigger in triggers:
            conditions = (trigger.config or {}).get("conditions", {})
            if not _match_conditions(email_ctx, conditions):
                continue

            # Dedup check
            existing = await session.execute(
                select(EmailMessage).where(
                    EmailMessage.mailbox_id == mailbox.id,
                    EmailMessage.provider_message_id == message_id,
                    EmailMessage.trigger_id == trigger.id,
                )
            )
            if existing.scalar_one_or_none():
                continue

            session.add(
                EmailMessage(
                    id=new_ulid(),
                    mailbox_id=mailbox.id,
                    provider_message_id=message_id,
                    trigger_id=trigger.id,
                )
            )
            context = {"email": email_ctx, "arguments": {}}
            mapping = (trigger.config or {}).get("argument_mapping", {})
            if mapping:
                from runflow_api.core.template_engine import render_argument_mapping
                context["arguments"] = render_argument_mapping(mapping, context)

            await fire_trigger(session, trigger, context, trigger_type_override=TriggerType.EMAIL)
            processed += 1

        if mailbox.mark_as_read:
            mail.store(msg_id, "+FLAGS", "\\Seen")

    mail.logout()
    return processed


async def email_poller_loop(interval: int = 60) -> None:
    import asyncio
    while True:
        try:
            count = await poll_mailboxes()
            if count:
                logger.info("Email poller processed %d messages", count)
        except Exception:
            logger.exception("Email poller failed")
        await asyncio.sleep(interval)
