#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Building runner images..."
docker build -f docker/runners/python/Dockerfile -t runflow/runner-python:0.1.0 .
docker build -f docker/runners/bash/Dockerfile -t runflow/runner-bash:0.1.0 .
docker build -f docker/runners/ansible/Dockerfile -t runflow/runner-ansible:0.1.0 .

echo "==> Runner images ready."
