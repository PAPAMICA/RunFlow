#!/usr/bin/env bash
# Diagnostic rapide RunFlow sur le serveur
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose --project-directory $ROOT -f $ROOT/deploy/docker-compose.server.yml --env-file $ROOT/.env"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-runflow_postgres}"
POSTGRES_HOST="${POSTGRES_HOST:-runflow_postgres}"

echo "=== Conteneurs ==="
$COMPOSE ps -a || true

echo ""
echo "=== Logs API (50 dernières lignes) ==="
docker logs --tail 50 runflow_api 2>&1 || true

echo ""
echo "=== Variables POSTGRES dans l'API ==="
$COMPOSE exec -T api env 2>/dev/null | grep '^POSTGRES_' || echo "(API non joignable)"

echo ""
echo "=== Tables en base (${POSTGRES_CONTAINER}) ==="
docker exec -i "$POSTGRES_CONTAINER" psql -U "${POSTGRES_USER:-runflow}" -d "${POSTGRES_DB:-runflow}" -c '\dt' 2>&1 || true

echo ""
echo "=== Test migrations manuelles ==="
echo "docker compose --project-directory . -f deploy/docker-compose.server.yml --env-file .env \\"
echo "  run --rm --no-deps --network runflow_internal \\"
echo "  -e POSTGRES_HOST=${POSTGRES_HOST} -e POSTGRES_PASSWORD=\$(grep ^POSTGRES_PASSWORD= .env | cut -d= -f2-) \\"
echo "  --entrypoint '' api /app/.venv/bin/alembic upgrade head"
