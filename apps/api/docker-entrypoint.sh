#!/bin/sh
set -e

echo "==> RunFlow API entrypoint"

python <<'PY'
from runflow_api.config import get_settings

s = get_settings()
print(
    f"==> Database target: {s.postgres_user}@{s.postgres_host}:{s.postgres_port}/{s.postgres_db}"
)
if not s.postgres_host or not s.postgres_password:
    raise SystemExit(
        "ERROR: POSTGRES_HOST and POSTGRES_PASSWORD must be set in the API container"
    )
PY

echo "==> Running database migrations..."
if ! alembic upgrade head; then
  echo "ERROR: alembic upgrade head failed" >&2
  exit 1
fi

echo "==> Starting API server..."
exec uvicorn runflow_api.main:app --host 0.0.0.0 --port 8000
