"""Valkey/Redis client for queue notifications and log pub/sub."""

from __future__ import annotations

import json
from typing import Any

import redis.asyncio as redis

from runflow_api.config import get_settings

_valkey_client: redis.Redis | None = None

RUN_QUEUE_CHANNEL = "runflow:runs:queued"
RUN_LOG_CHANNEL_PREFIX = "runflow:runs:logs:"
RUN_STATUS_CHANNEL_PREFIX = "runflow:runs:status:"


async def get_valkey() -> redis.Redis:
    global _valkey_client
    if _valkey_client is None:
        settings = get_settings()
        _valkey_client = redis.from_url(settings.valkey_url, decode_responses=True)
    return _valkey_client


async def close_valkey() -> None:
    global _valkey_client
    if _valkey_client is not None:
        await _valkey_client.aclose()
        _valkey_client = None


async def publish_run_queued(run_id: str, organization_id: str) -> None:
    client = await get_valkey()
    await client.publish(
        RUN_QUEUE_CHANNEL,
        json.dumps({"run_id": run_id, "organization_id": organization_id}),
    )


async def publish_run_log(run_id: str, payload: dict[str, Any]) -> None:
    client = await get_valkey()
    await client.publish(f"{RUN_LOG_CHANNEL_PREFIX}{run_id}", json.dumps(payload))


async def publish_run_status(run_id: str, status: str) -> None:
    client = await get_valkey()
    await client.publish(
        f"{RUN_STATUS_CHANNEL_PREFIX}{run_id}",
        json.dumps({"run_id": run_id, "status": status}),
    )


async def check_valkey_health() -> bool:
    try:
        client = await get_valkey()
        return bool(await client.ping())
    except Exception:
        return False
