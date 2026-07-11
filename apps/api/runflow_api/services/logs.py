"""Run log persistence and streaming helpers."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.core.secret_redaction import SecretRedactor
from runflow_api.models import RunLog
from runflow_api.services.valkey import publish_run_log
from runflow_api.utils import new_ulid, utcnow


async def append_logs(
    session: AsyncSession,
    run_id: str,
    entries: list[dict],
    redactor: SecretRedactor | None = None,
) -> list[RunLog]:
    redactor = redactor or SecretRedactor()
    result = await session.execute(
        select(func.coalesce(func.max(RunLog.sequence), 0)).where(RunLog.run_id == run_id)
    )
    next_seq = int(result.scalar_one()) + 1

    created: list[RunLog] = []
    for entry in entries:
        message = redactor.redact(str(entry.get("message", "")))
        log = RunLog(
            id=new_ulid(),
            run_id=run_id,
            sequence=next_seq,
            stream=entry.get("stream", "stdout"),
            message=message,
            timestamp=entry.get("timestamp") or utcnow(),
        )
        session.add(log)
        created.append(log)
        await publish_run_log(
            run_id,
            {
                "sequence": log.sequence,
                "stream": log.stream,
                "message": log.message,
                "timestamp": log.timestamp.isoformat(),
            },
        )
        next_seq += 1

    await session.flush()
    return created


async def get_logs_after(
    session: AsyncSession, run_id: str, after_sequence: int = 0
) -> list[RunLog]:
    result = await session.execute(
        select(RunLog)
        .where(RunLog.run_id == run_id, RunLog.sequence > after_sequence)
        .order_by(RunLog.sequence.asc())
    )
    return list(result.scalars().all())
