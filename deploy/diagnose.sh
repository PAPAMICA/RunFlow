#!/usr/bin/env bash
# Diagnostic rapide RunFlow sur le serveur
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose --project-directory $ROOT -f $ROOT/deploy/docker-compose.server.yml --env-file $ROOT/.env"

echo "=== Conteneurs ==="
$COMPOSE ps -a || true

echo ""
echo "=== Logs API (50 dernières lignes) ==="
docker logs --tail 50 runflow_api 2>&1 || true

echo ""
echo "=== Variables POSTGRES dans l'API ==="
$COMPOSE exec -T api env 2>/dev/null | grep '^POSTGRES_' || echo "(API non joignable)"

echo ""
echo "=== Tables en base ==="
$COMPOSE exec -T postgres psql -U "${POSTGRES_USER:-runflow}" -d "${POSTGRES_DB:-runflow}" -c '\dt' 2>&1 || true

echo ""
echo "=== Test migrations manuelles ==="
echo "Commande : $COMPOSE run --rm --no-deps --entrypoint '' api /app/.venv/bin/alembic upgrade head"
