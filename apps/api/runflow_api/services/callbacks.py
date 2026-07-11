"""HTTP callback delivery with retries."""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.core.encryption import decrypt
from runflow_api.db import async_session_factory
from runflow_api.models import Callback, CallbackAttempt, Run
from runflow_api.utils import new_ulid, utcnow

logger = logging.getLogger(__name__)


async def deliver_callbacks_for_run(run_id: str) -> None:
    asyncio.create_task(_deliver_callbacks(run_id))


async def _deliver_callbacks(run_id: str) -> None:
    async with async_session_factory() as session:
        run_result = await session.execute(select(Run).where(Run.id == run_id))
        run = run_result.scalar_one_or_none()
        if not run:
            return

        cb_result = await session.execute(
            select(Callback).where(
                Callback.resource_type == "job",
                Callback.resource_id == run.job_id,
                Callback.enabled.is_(True),
            )
        )
        callbacks = cb_result.scalars().all()

        payload = {
            "run_id": run.id,
            "status": run.status,
            "result": run.result,
            "exit_code": run.exit_code,
        }

        for cb in callbacks:
            await _deliver_with_retries(session, cb, run.id, payload)
        await session.commit()


async def _deliver_with_retries(
    session: AsyncSession, cb: Callback, run_id: str, payload: dict
) -> None:
    headers = {"Content-Type": "application/json"}
    body = json.dumps(payload).encode()

    if cb.auth_type == "bearer" and cb.auth_config_encrypted:
        token = decrypt(cb.auth_config_encrypted, cb.auth_config_nonce or "")
        auth_data = json.loads(token)
        headers["Authorization"] = f"Bearer {auth_data.get('token', '')}"
    elif cb.auth_type == "hmac_sha256" and cb.auth_config_encrypted:
        secret_data = json.loads(decrypt(cb.auth_config_encrypted, cb.auth_config_nonce or ""))
        sig = hmac.new(secret_data["secret"].encode(), body, hashlib.sha256).hexdigest()
        headers["X-Signature-256"] = f"sha256={sig}"

    for attempt in range(cb.max_retries):
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(cb.url, content=body, headers=headers)
            success = 200 <= resp.status_code < 300
            session.add(
                CallbackAttempt(
                    id=new_ulid(),
                    callback_id=cb.id,
                    run_id=run_id,
                    status_code=resp.status_code,
                    success=success,
                    attempted_at=utcnow(),
                )
            )
            if success:
                return
        except Exception as exc:
            session.add(
                CallbackAttempt(
                    id=new_ulid(),
                    callback_id=cb.id,
                    run_id=run_id,
                    success=False,
                    error=str(exc),
                    attempted_at=utcnow(),
                )
            )
        await asyncio.sleep(cb.retry_delay_seconds)
