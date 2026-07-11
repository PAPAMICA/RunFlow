#!/bin/sh
set -e

echo "==> RunFlow API entrypoint"

echo "==> Waiting for Postgres..."
python <<'PY'
import asyncio
import os
import sys

import asyncpg


async def main() -> None:
    host = os.environ.get("POSTGRES_HOST", "postgres")
    port = int(os.environ.get("POSTGRES_PORT", "5432"))
    user = os.environ.get("POSTGRES_USER", "runflow")
    password = os.environ.get("POSTGRES_PASSWORD", "")
    database = os.environ.get("POSTGRES_DB", "runflow")

    for attempt in range(1, 61):
        try:
            conn = await asyncpg.connect(
                host=host,
                port=port,
                user=user,
                password=password,
                database=database,
            )
            await conn.close()
            print(f"==> Postgres ready (attempt {attempt})")
            return
        except Exception as exc:
            print(f"==> Waiting for Postgres ({attempt}/60): {exc}")
            await asyncio.sleep(2)

    print("ERROR: Postgres not reachable with configured credentials", file=sys.stderr)
    sys.exit(1)


asyncio.run(main())
PY

echo "==> Running database migrations..."
alembic upgrade head

echo "==> Starting API server..."
exec uvicorn runflow_api.main:app --host 0.0.0.0 --port 8000
