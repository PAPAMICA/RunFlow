"""HTTP polling triggers — fire jobs when a remote endpoint changes."""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from typing import Any

import httpx
from sqlalchemy import select

from runflow_api.db import async_session_factory
from runflow_api.models import Trigger
from runflow_api.services.triggers import fire_trigger
from runflow_shared import TriggerType

logger = logging.getLogger(__name__)

_last_state: dict[str, str] = {}


def _body_hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()


def _extract_json_path(data: Any, path: str) -> str:
    current = data
    for part in path.split("."):
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return ""
    return json.dumps(current, sort_keys=True) if current is not None else ""


async def run_http_poll_tick() -> int:
    fired = 0
    async with async_session_factory() as session:
        result = await session.execute(
            select(Trigger).where(
                Trigger.trigger_type == TriggerType.HTTP_POLL,
                Trigger.enabled.is_(True),
            )
        )
        triggers = result.scalars().all()

        for trigger in triggers:
            config = trigger.config or {}
            url = config.get("url", "").strip()
            if not url:
                continue

            method = (config.get("method") or "GET").upper()
            headers = config.get("headers") or {}
            timeout = min(int(config.get("timeout_seconds", 30)), 120)

            try:
                async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                    resp = await client.request(method, url, headers=headers)
                body = resp.text
            except Exception as exc:
                logger.warning("HTTP poll failed for trigger %s: %s", trigger.id, exc)
                continue

            detection = config.get("change_detection", "body_hash")
            if detection == "json_path" and config.get("json_path"):
                try:
                    state = _extract_json_path(resp.json(), config["json_path"])
                except Exception:
                    state = body[:2000]
            else:
                state = _body_hash(body)

            prev = _last_state.get(trigger.id)
            fire_on_first = bool(config.get("fire_on_first", False))

            if prev is None:
                _last_state[trigger.id] = state
                if fire_on_first:
                    context = {
                        "poll": {
                            "url": url,
                            "status_code": resp.status_code,
                            "body_preview": body[:2000],
                            "state": state,
                        },
                        "arguments": config.get("default_arguments", {}),
                    }
                    await fire_trigger(session, trigger, context, trigger_type_override=TriggerType.HTTP_POLL)
                    fired += 1
                continue

            if state != prev:
                _last_state[trigger.id] = state
                context = {
                    "poll": {
                        "url": url,
                        "status_code": resp.status_code,
                        "body_preview": body[:2000],
                        "previous_state": prev,
                        "state": state,
                    },
                    "arguments": config.get("default_arguments", {}),
                }
                await fire_trigger(session, trigger, context, trigger_type_override=TriggerType.HTTP_POLL)
                fired += 1

        if fired:
            await session.commit()
    return fired


async def http_poller_loop(interval: int = 60) -> None:
    while True:
        try:
            count = await run_http_poll_tick()
            if count:
                logger.info("HTTP poller fired %d triggers", count)
        except Exception:
            logger.exception("HTTP poller tick failed")
        await asyncio.sleep(interval)
