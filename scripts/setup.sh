#!/usr/bin/env bash
set -euo pipefail

echo "==> Preparing data directories..."
mkdir -p data/postgres data/runflow data/worker

echo "==> Building runner images..."
docker build -f docker/runners/python/Dockerfile -t runflow/runner-python:0.1.0 .
docker build -f docker/runners/bash/Dockerfile -t runflow/runner-bash:0.1.0 .
docker build -f docker/runners/ansible/Dockerfile -t runflow/runner-ansible:0.1.0 .

echo "==> Starting RunFlow..."
docker compose up -d --build

echo "==> Waiting for API..."
sleep 10
curl -sf http://localhost:8000/health || { echo "API not ready"; exit 1; }

echo ""
echo "RunFlow is up!"
echo "  Web: http://localhost:3000"
echo "  API: http://localhost:8000/docs"
echo ""
echo "Next steps:"
echo "  docker compose exec api runflow create-admin --email admin@runflow.local"
echo "  docker compose exec api runflow-seed seed-demo-job"
echo "  docker compose exec api runflow worker-create-registration-token --name local-worker --org-id <ORG_ID>"
echo "  # Set RUNFLOW_WORKER_TOKEN in .env and: docker compose up -d worker"
