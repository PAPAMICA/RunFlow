#!/usr/bin/env bash
# Diagnostic rapide RunFlow sur le serveur
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose --project-directory $ROOT -f $ROOT/deploy/docker-compose.server.yml --env-file $ROOT/.env"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-runflow_postgres}"

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
echo "docker run --rm --network \$(docker inspect -f '{{range \$k,\$v := .NetworkSettings.Networks}}{{\$k}}{{end}}' ${POSTGRES_CONTAINER}) \\"
echo "  -e POSTGRES_HOST=${POSTGRES_CONTAINER} -e POSTGRES_PASSWORD=\$(grep ^POSTGRES_PASSWORD= .env | cut -d= -f2-) \\"
echo "  -e POSTGRES_USER=runflow -e POSTGRES_DB=runflow -e PYTHONPATH=/app/apps/api \\"
echo "  runflow/api:0.1.0 /app/.venv/bin/alembic upgrade head"
