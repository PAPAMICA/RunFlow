#!/bin/sh
set -e

echo "==> RunFlow API entrypoint"

echo "==> Running database migrations..."
alembic upgrade head

echo "==> Starting API server..."
exec uvicorn runflow_api.main:app --host 0.0.0.0 --port 8000
