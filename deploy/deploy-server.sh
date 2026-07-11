#!/usr/bin/env bash
# Déploiement complet du serveur RunFlow (Traefik + worker intégré)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="$ROOT/deploy/docker-compose.server.yml"
ENV_FILE="$ROOT/.env"
COMPOSE="docker compose --project-directory $ROOT -f $COMPOSE_FILE --env-file $ENV_FILE"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-runflow_postgres}"
POSTGRES_HOST="${POSTGRES_HOST:-$POSTGRES_CONTAINER}"
WORKER_NAME="${WORKER_NAME:-server}"
WORKER_DIR="$ROOT/data/worker-${WORKER_NAME}"
WORKER_ENV="$WORKER_DIR/worker.env"

log() { echo "==> $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options :
  --reset       Arrête la stack et supprime data/ avant déploiement
  --logs        Affiche les derniers logs puis suit api, web et worker
  --logs-only   Diagnostic + logs uniquement (sans redéployer)
  -h, --help    Cette aide

Exemples :
  ./deploy/deploy-server.sh --logs
  ./deploy/deploy-server.sh --logs-only
  ./deploy/deploy-server.sh --logs-only web
EOF
}

LOGS_FOLLOW=0
LOGS_ONLY=0
RESET_DONE=0
LOG_SERVICES="api web worker"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Commande requise introuvable : $1"
}

load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
    # Retirer les CR éventuels (fichier .env édité sous Windows)
    POSTGRES_PASSWORD="${POSTGRES_PASSWORD//$'\r'/}"
    JWT_SECRET="${JWT_SECRET//$'\r'/}"
    RUNFLOW_MASTER_KEY="${RUNFLOW_MASTER_KEY//$'\r'/}"
    RUNFLOW_ADMIN_PASSWORD="${RUNFLOW_ADMIN_PASSWORD//$'\r'/}"
    RUNFLOW_WEB_HOST="${RUNFLOW_WEB_HOST//$'\r'/}"
    RUNFLOW_API_HOST="${RUNFLOW_API_HOST//$'\r'/}"
    CORS_ORIGINS="${CORS_ORIGINS//$'\r'/}"
  fi
}

generate_secret() {
  openssl rand -hex 24
}

export_compose_env() {
  load_env
  export POSTGRES_USER="${POSTGRES_USER:-runflow}"
  export POSTGRES_DB="${POSTGRES_DB:-runflow}"
  export POSTGRES_HOST="${POSTGRES_CONTAINER}"
  export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
  export POSTGRES_PASSWORD
  export JWT_SECRET RUNFLOW_MASTER_KEY
}

postgres_container_network() {
  docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' "$POSTGRES_CONTAINER" | head -1
}

docker_run_api() {
  export_compose_env
  local network
  network="$(postgres_container_network)"
  [[ -n "$network" ]] || die "Réseau Docker introuvable pour ${POSTGRES_CONTAINER}"
  docker run --rm \
    --entrypoint "" \
    --network "$network" \
    -e "POSTGRES_HOST=${POSTGRES_CONTAINER}" \
    -e "POSTGRES_PORT=${POSTGRES_PORT}" \
    -e "POSTGRES_USER=${POSTGRES_USER}" \
    -e "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" \
    -e "POSTGRES_DB=${POSTGRES_DB}" \
    -e "PYTHONPATH=/app/apps/api" \
    runflow/api:0.1.0 \
    "$@"
}

generate_and_save_postgres_password() {
  local reason="${1:-initialisation}"
  POSTGRES_PASSWORD="$(generate_secret)"
  patch_env_var "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD"
  patch_env_var "POSTGRES_HOST" "${POSTGRES_CONTAINER}"
  export_compose_env
  log "POSTGRES_PASSWORD généré (${reason})"
  echo ""
  echo "    Postgres : ${POSTGRES_USER}@${POSTGRES_CONTAINER}/${POSTGRES_DB}"
  echo "    Conteneur: ${POSTGRES_CONTAINER}"
  echo "    Mot de passe : ${POSTGRES_PASSWORD}"
  echo ""
}

ensure_env_file() {
  if [[ ! -f "$ENV_FILE" ]]; then
    log "Création de .env depuis deploy/.env.server.example"
    cp deploy/.env.server.example "$ENV_FILE"
    die "Éditez $ENV_FILE (domaines RUNFLOW_WEB_HOST, RUNFLOW_API_HOST) puis relancez ce script."
  fi
  load_env
}

patch_env_var() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
  rm -f "${ENV_FILE}.bak"
}

postgres_data_exists() {
  [[ -f "$ROOT/data/postgres/PG_VERSION" ]]
}

escape_sql_string() {
  printf "%s" "$1" | sed "s/'/''/g"
}

ensure_generated_secrets() {
  local changed=0
  if [[ -z "${JWT_SECRET:-}" || "${JWT_SECRET}" == change-me* ]]; then
    JWT_SECRET="$(generate_secret)"
    patch_env_var "JWT_SECRET" "$JWT_SECRET"
    log "JWT_SECRET généré"
    changed=1
  fi
  if [[ -z "${RUNFLOW_MASTER_KEY:-}" || "${RUNFLOW_MASTER_KEY}" == change-me* ]]; then
    RUNFLOW_MASTER_KEY="$(generate_secret)"
    patch_env_var "RUNFLOW_MASTER_KEY" "$RUNFLOW_MASTER_KEY"
    log "RUNFLOW_MASTER_KEY générée"
    changed=1
  fi
  if postgres_data_exists; then
    [[ -n "${POSTGRES_PASSWORD:-}" ]] \
      || die "Données Postgres existantes : définissez POSTGRES_PASSWORD dans .env (mot de passe actuel ou nouveau après sync)"
    log "Données Postgres existantes — POSTGRES_PASSWORD conservé depuis .env"
  elif [[ -z "${POSTGRES_PASSWORD:-}" || "${POSTGRES_PASSWORD}" == change-me* ]]; then
    generate_and_save_postgres_password "première installation"
    changed=1
  fi
  if [[ -z "${RUNFLOW_ADMIN_PASSWORD:-}" ]]; then
    RUNFLOW_ADMIN_PASSWORD="$(generate_secret)"
    patch_env_var "RUNFLOW_ADMIN_PASSWORD" "$RUNFLOW_ADMIN_PASSWORD"
    log "RUNFLOW_ADMIN_PASSWORD généré (notez-le)"
    echo ""
    echo "    Admin : ${RUNFLOW_ADMIN_EMAIL:-admin@runflow.local}"
    echo "    Mot de passe : ${RUNFLOW_ADMIN_PASSWORD}"
    echo ""
    changed=1
  fi
  if [[ $changed -eq 1 ]]; then
    load_env
  fi

  sync_web_urls
}

normalize_host() {
  local host="$1"
  host="${host#https://}"
  host="${host#http://}"
  host="${host%%/*}"
  printf "%s" "$host"
}

sync_web_urls() {
  if [[ -z "${RUNFLOW_WEB_HOST:-}" ]]; then
    return 0
  fi
  RUNFLOW_WEB_HOST="$(normalize_host "$RUNFLOW_WEB_HOST")"
  patch_env_var "RUNFLOW_WEB_HOST" "$RUNFLOW_WEB_HOST"
  patch_env_var "CORS_ORIGINS" "https://${RUNFLOW_WEB_HOST}"
  if [[ -n "${RUNFLOW_API_HOST:-}" ]]; then
    RUNFLOW_API_HOST="$(normalize_host "$RUNFLOW_API_HOST")"
    patch_env_var "RUNFLOW_API_HOST" "$RUNFLOW_API_HOST"
    patch_env_var "NEXT_PUBLIC_API_URL" "https://${RUNFLOW_API_HOST}"
  fi
  load_env
  log "CORS : https://${RUNFLOW_WEB_HOST}"
}

validate_env() {
  [[ -n "${RUNFLOW_WEB_HOST:-}" && "${RUNFLOW_WEB_HOST}" != *example.com* ]] \
    || die "Configurez RUNFLOW_WEB_HOST dans .env (domaine réel, pas example.com)"
  [[ -n "${RUNFLOW_API_HOST:-}" && "${RUNFLOW_API_HOST}" != *example.com* ]] \
    || die "Configurez RUNFLOW_API_HOST dans .env (domaine réel, pas example.com)"
}

ensure_worker_stub() {
  mkdir -p "$WORKER_DIR"
  if [[ ! -f "$WORKER_ENV" ]]; then
    cat >"$WORKER_ENV" <<EOF
RUNFLOW_API_URL=http://api:8000
RUNFLOW_WORKER_TOKEN=
EOF
    chmod 600 "$WORKER_ENV"
    log "Fichier worker temporaire créé ($WORKER_ENV)"
  fi
}

wait_for_service_healthy() {
  local container="$1"
  log "Attente de ${container}..."
  local i status
  for i in $(seq 1 60); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container" 2>/dev/null || true)"
    if [[ "$status" == "healthy" ]]; then
      return 0
    fi
    sleep 2
  done
  die "${container} n'est pas healthy"
}

wait_for_api() {
  log "Attente de l'API..."
  local i status
  for i in $(seq 1 90); do
    if $COMPOSE exec -T api curl -sf http://localhost:8000/health >/dev/null 2>&1; then
      log "API prête"
      return 0
    fi
    status="$(docker inspect --format '{{.State.Status}}' runflow_api 2>/dev/null || true)"
    if [[ "$status" == "restarting" || "$status" == "exited" ]]; then
      log "Conteneur API en échec, logs récents :"
      docker logs --tail 40 runflow_api 2>&1 || true
      die "Le conteneur runflow_api a crashé (status=${status})"
    fi
    if (( i % 15 == 0 )); then
      log "Toujours en attente (${i}/90) — derniers logs API :"
      docker logs --tail 15 runflow_api 2>&1 || true
    fi
    sleep 2
  done
  log "Derniers logs API :"
  docker logs --tail 40 runflow_api 2>&1 || true
  die "L'API n'a pas démarré dans le délai imparti"
}

verify_api_cors() {
  log "Vérification CORS API..."
  local origins
  origins="$($COMPOSE exec -T api /app/.venv/bin/python -c \
    "from runflow_api.config import get_settings; print(','.join(get_settings().cors_origin_list))" \
    2>/dev/null || true)"
  if [[ -z "$origins" ]]; then
    log "Impossible de lire la config CORS depuis l'API"
    return 0
  fi
  log "Origines CORS API : ${origins}"
  if [[ "$origins" != *"${RUNFLOW_WEB_HOST}"* ]]; then
    die "CORS non configuré pour https://${RUNFLOW_WEB_HOST} — vérifiez RUNFLOW_WEB_HOST dans .env"
  fi
}

users_table_exists() {
  local pg_user="${POSTGRES_USER:-runflow}"
  local pg_db="${POSTGRES_DB:-runflow}"
  docker exec -i "$POSTGRES_CONTAINER" psql -U "$pg_user" -d "$pg_db" -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users'" \
    2>/dev/null | grep -q 1
}

run_db_migrations() {
  if users_table_exists; then
    log "Schéma base de données déjà migré"
    return 0
  fi

  log "Application des migrations Alembic (one-shot, avant démarrage API)..."
  log "Cible : ${POSTGRES_USER}@${POSTGRES_CONTAINER}:${POSTGRES_PORT}/${POSTGRES_DB}"

  if ! docker_run_api /app/.venv/bin/alembic upgrade head; then
    log "Diagnostic configuration API :"
    docker_run_api /app/.venv/bin/python -c \
      "from runflow_api.config import get_settings; s=get_settings(); print('host=', s.postgres_host, 'db=', s.postgres_db, 'password_set=', bool(s.postgres_password))" \
      || true
    die "Les migrations Alembic ont échoué"
  fi

  if ! users_table_exists; then
    die "Les migrations ont été exécutées mais la table users est toujours absente"
  fi
  log "Migrations appliquées avec succès"
}

sync_postgres_password() {
  if ! postgres_data_exists; then
    return 0
  fi
  local pg_user="${POSTGRES_USER:-runflow}"
  local pg_password_escaped
  pg_password_escaped="$(escape_sql_string "${POSTGRES_PASSWORD}")"
  log "Synchronisation du mot de passe Postgres (${pg_user}@${POSTGRES_CONTAINER}) avec .env..."
  docker exec -i "$POSTGRES_CONTAINER" psql -U "$pg_user" -d postgres \
    -c "ALTER USER ${pg_user} PASSWORD '${pg_password_escaped}';" \
    >/dev/null
  log "Mot de passe Postgres aligné sur .env"
}

verify_postgres_tcp_auth() {
  log "Vérification authentification Postgres (TCP → ${POSTGRES_CONTAINER})..."
  if docker_run_api /app/.venv/bin/python -c "
import asyncio
import os
import sys

import asyncpg


async def main() -> None:
    conn = await asyncpg.connect(
        host=os.environ['POSTGRES_HOST'],
        port=int(os.environ.get('POSTGRES_PORT', '5432')),
        user=os.environ.get('POSTGRES_USER', 'runflow'),
        password=os.environ.get('POSTGRES_PASSWORD', ''),
        database=os.environ.get('POSTGRES_DB', 'runflow'),
    )
    await conn.close()
    print('OK')


try:
    asyncio.run(main())
except Exception as exc:
    print(f'FAIL: {exc}', file=sys.stderr)
    raise SystemExit(1)
"; then
    log "Authentification Postgres OK (${POSTGRES_CONTAINER})"
    return 0
  fi
  return 1
}

ensure_admin() {
  local email="${RUNFLOW_ADMIN_EMAIL:-admin@runflow.local}"
  local password="${RUNFLOW_ADMIN_PASSWORD:?RUNFLOW_ADMIN_PASSWORD manquant dans .env}"

  log "Création de l'administrateur (${email}) si nécessaire..."
  if $COMPOSE exec -T api runflow create-admin \
      --email "$email" \
      --password "$password" \
      --org-name "Default Organization" \
      --org-slug default; then
    log "Administrateur créé"
    return 0
  fi

  log "Création échouée — tentative de mise à jour du mot de passe..."
  if $COMPOSE exec -T api runflow reset-admin-password \
      --email "$email" \
      --password "$password"; then
    log "Mot de passe administrateur mis à jour"
    return 0
  fi

  die "Impossible de créer ou mettre à jour l'administrateur ${email}"
}

ensure_worker_credentials() {
  mkdir -p "$WORKER_DIR"

  if [[ -f "$WORKER_ENV" ]] && grep -qE '^RUNFLOW_WORKER_TOKEN=rf_wkr_' "$WORKER_ENV"; then
    log "Worker déjà configuré ($WORKER_ENV)"
    return 0
  fi

  log "Création du worker intégré (${WORKER_NAME})..."
  local token
  token="$($COMPOSE exec -T api runflow worker-create \
    --name "$WORKER_NAME" \
    --token-only)"

  if [[ -z "$token" || "$token" != rf_wkr_* ]]; then
    die "Échec de création du worker (token invalide)"
  fi

  cat >"$WORKER_ENV" <<EOF
RUNFLOW_API_URL=http://api:8000
RUNFLOW_WORKER_TOKEN=${token}
EOF
  chmod 600 "$WORKER_ENV"
  patch_env_var "RUNFLOW_WORKER_TOKEN" "$token"
  load_env
  log "Credentials worker écrits dans $WORKER_ENV"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --reset)
        RESET_DONE=1
        shift
        ;;
      --logs)
        LOGS_FOLLOW=1
        shift
        ;;
      --logs-only)
        LOGS_ONLY=1
        shift
        if [[ $# -gt 0 && "$1" != --* ]]; then
          LOG_SERVICES="$1"
          shift
        fi
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "Argument inconnu : $1 (voir --help)"
        ;;
    esac
  done
}

print_log_commands() {
  echo " Logs   : $COMPOSE logs --tail=100 api web worker"
  echo "          : $COMPOSE logs -f api web worker"
  echo "          : $0 --logs-only"
}

show_container_logs() {
  local container="$1"
  local lines="${2:-60}"
  if docker inspect "$container" >/dev/null 2>&1; then
    echo "--- ${container} (dernières ${lines} lignes) ---"
    docker logs --tail "$lines" "$container" 2>&1 || true
    echo ""
  fi
}

diagnose_stack() {
  log "Diagnostic des conteneurs..."
  local c status health
  for c in runflow_web runflow_api runflow_postgres runflow_valkey "runflow_worker_${WORKER_NAME:-server}"; do
    if ! docker inspect "$c" >/dev/null 2>&1; then
      log "${c} : absent"
      continue
    fi
    status="$(docker inspect --format '{{.State.Status}}' "$c" 2>/dev/null || echo unknown)"
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}}' "$c" 2>/dev/null || echo n/a)"
    log "${c} : status=${status} health=${health}"
  done

  if docker inspect runflow_web >/dev/null 2>&1; then
    log "Test HTTP interne web (localhost:3000)..."
    if docker exec runflow_web node -e "
const http = require('http');
const req = http.get('http://127.0.0.1:3000/login', (res) => {
  console.log('HTTP', res.statusCode);
  process.exit(res.statusCode < 500 ? 0 : 1);
});
req.on('error', (err) => { console.error(err.message); process.exit(1); });
req.setTimeout(8000, () => { console.error('timeout'); process.exit(1); });
" 2>&1; then
      log "Web répond en interne"
    else
      log "Web ne répond pas en interne — logs :"
      show_container_logs runflow_web 80
    fi
  fi
}

show_logs() {
  local services="${1:-$LOG_SERVICES}"
  log "Derniers logs (${services})..."
  $COMPOSE logs --tail=100 $services 2>&1 || true
  echo ""
  log "Suivi des logs (Ctrl+C pour quitter) : $COMPOSE logs -f $services"
  $COMPOSE logs -f $services
}

wait_for_web() {
  log "Attente de l'interface web..."
  local i status
  for i in $(seq 1 60); do
    if docker exec runflow_web node -e "
const http = require('http');
const req = http.get('http://127.0.0.1:3000/login', (res) => process.exit(res.statusCode < 500 ? 0 : 1));
req.on('error', () => process.exit(1));
req.setTimeout(5000, () => process.exit(1));
" >/dev/null 2>&1; then
      log "Interface web prête"
      return 0
    fi
    status="$(docker inspect --format '{{.State.Status}}' runflow_web 2>/dev/null || true)"
    if [[ "$status" == "restarting" || "$status" == "exited" ]]; then
      log "Conteneur web en échec, logs récents :"
      show_container_logs runflow_web 80
      die "Le conteneur runflow_web a crashé (status=${status})"
    fi
    if (( i % 10 == 0 )); then
      log "Toujours en attente web (${i}/60) — derniers logs :"
      show_container_logs runflow_web 20
    fi
    sleep 2
  done
  show_container_logs runflow_web 80
  die "L'interface web n'a pas démarré (502 probable côté Traefik)"
}

main() {
  require_cmd docker
  require_cmd openssl

  parse_args "$@"

  ensure_env_file
  load_env
  export_compose_env

  WORKER_NAME="${WORKER_NAME:-server}"
  WORKER_DIR="$ROOT/data/worker-${WORKER_NAME}"
  WORKER_ENV="$WORKER_DIR/worker.env"

  if [[ $LOGS_ONLY -eq 1 ]]; then
    diagnose_stack
    show_logs "$LOG_SERVICES"
    exit 0
  fi

  if [[ $RESET_DONE -eq 1 ]]; then
    log "Reset complet : arrêt des conteneurs et suppression de data/"
    $COMPOSE down --remove-orphans || true
    rm -rf "$ROOT/data"
  fi

  ensure_generated_secrets

  local fresh_postgres=0
  if [[ ! -f "$ROOT/data/postgres/PG_VERSION" ]]; then
    fresh_postgres=1
  fi

  if [[ $RESET_DONE -eq 1 ]]; then
    generate_and_save_postgres_password "reset complet"
  elif [[ $fresh_postgres -eq 1 ]]; then
    generate_and_save_postgres_password "nouvelle base de données"
  fi
  export_compose_env
  validate_env

  log "Préparation des répertoires de données..."
  mkdir -p "$ROOT/data/postgres" "$ROOT/data/runflow"
  ensure_worker_stub

  log "Réseau Traefik (proxy)..."
  docker network inspect "${TRAEFIK_NETWORK:-proxy}" >/dev/null 2>&1 \
    || docker network create "${TRAEFIK_NETWORK:-proxy}"

  log "Construction des images runner..."
  "$ROOT/deploy/build-runners.sh"

  log "Build et démarrage de Postgres + Valkey..."
  export_compose_env
  if [[ $fresh_postgres -eq 1 ]]; then
    log "Nouvelle base Postgres — initialisation..."
    $COMPOSE up -d --force-recreate postgres valkey
  else
    $COMPOSE up -d postgres valkey
  fi
  wait_for_service_healthy runflow_postgres
  wait_for_service_healthy runflow_valkey
  sync_postgres_password

  log "Build image API..."
  $COMPOSE build api

  if ! verify_postgres_tcp_auth; then
    log "Échec auth TCP — nouvelle synchronisation du mot de passe..."
    sync_postgres_password
    verify_postgres_tcp_auth || die "Postgres refuse le mot de passe du .env (vérifiez POSTGRES_PASSWORD)"
  fi

  run_db_migrations

  log "Démarrage de l'API..."
  export_compose_env
  $COMPOSE up -d --force-recreate api
  wait_for_api
  verify_api_cors

  log "Démarrage de l'interface web..."
  $COMPOSE up -d --build --force-recreate web
  wait_for_web
  ensure_admin
  ensure_worker_credentials

  log "Démarrage du worker..."
  $COMPOSE up -d --build --force-recreate worker

  log "État des services :"
  $COMPOSE ps

  echo ""
  echo "=============================================="
  echo " RunFlow déployé avec succès"
  echo "=============================================="
  echo " Web  : https://${RUNFLOW_WEB_HOST}/login"
  echo " API  : https://${RUNFLOW_API_HOST}"
  echo " Admin: ${RUNFLOW_ADMIN_EMAIL:-admin@runflow.local}"
  echo "        (mot de passe dans .env → RUNFLOW_ADMIN_PASSWORD)"
  echo ""
  echo " Postgres: ${POSTGRES_USER}@${POSTGRES_HOST}/${POSTGRES_DB}"
  echo "           (mot de passe dans .env → POSTGRES_PASSWORD)"
  echo ""
  echo " Worker : ${WORKER_NAME} (réseau interne → http://api:8000)"
  echo " Données: $ROOT/data/"
  echo ""
  print_log_commands
  echo "=============================================="

  if [[ $LOGS_FOLLOW -eq 1 ]]; then
    echo ""
    diagnose_stack
    show_logs "$LOG_SERVICES"
  fi
}

main "$@"
