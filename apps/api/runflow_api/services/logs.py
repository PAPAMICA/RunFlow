"""Run log persistence and streaming helpers."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from runflow_api.core.secret_redaction import SecretRedactor
from runflow_api.models import RunLog
from runflow_api.services.valkey import publish_run_log
from runflow_api.utils import new_ulid, utcnow


def _parse_log_timestamp(value: datetime | str | None) -> datetime:
    if value is None:
        return utcnow()
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
        except ValueError:
            return utcnow()
    return utcnow()


def _format_log_timestamp(value: datetime | str) -> str:
    if isinstance(value, str):
        return value
    return value.isoformat()


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
        timestamp = _parse_log_timestamp(entry.get("timestamp"))
        log = RunLog(
            id=new_ulid(),
            run_id=run_id,
            sequence=next_seq,
            stream=entry.get("stream", "stdout"),
            message=message,
            timestamp=timestamp,
        )
        session.add(log)
        created.append(log)
        await publish_run_log(
            run_id,
            {
                "sequence": log.sequence,
                "stream": log.stream,
                "message": log.message,
                "timestamp": _format_log_timestamp(log.timestamp),
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
