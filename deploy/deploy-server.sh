#!/usr/bin/env bash
# Déploiement complet du serveur RunFlow (Traefik + worker intégré)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="$ROOT/deploy/docker-compose.server.yml"
ENV_FILE="$ROOT/.env"
COMPOSE="docker compose --project-directory $ROOT -f $COMPOSE_FILE --env-file $ENV_FILE"
WORKER_NAME="${WORKER_NAME:-server}"
WORKER_DIR="$ROOT/data/worker-${WORKER_NAME}"
WORKER_ENV="$WORKER_DIR/worker.env"

log() { echo "==> $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Commande requise introuvable : $1"
}

load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
  fi
}

generate_secret() {
  openssl rand -hex 24
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
    POSTGRES_PASSWORD="$(generate_secret)"
    patch_env_var "POSTGRES_PASSWORD" "$POSTGRES_PASSWORD"
    log "POSTGRES_PASSWORD généré"
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

  if [[ -n "${RUNFLOW_WEB_HOST:-}" ]]; then
    patch_env_var "CORS_ORIGINS" "https://${RUNFLOW_WEB_HOST}"
  fi
  if [[ -n "${RUNFLOW_API_HOST:-}" ]]; then
    patch_env_var "NEXT_PUBLIC_API_URL" "https://${RUNFLOW_API_HOST}"
  fi
  load_env
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

users_table_exists() {
  local pg_user="${POSTGRES_USER:-runflow}"
  local pg_db="${POSTGRES_DB:-runflow}"
  $COMPOSE exec -T postgres psql -U "$pg_user" -d "$pg_db" -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users'" \
    2>/dev/null | grep -q 1
}

run_db_migrations() {
  if users_table_exists; then
    log "Schéma base de données déjà migré"
    return 0
  fi

  log "Application des migrations Alembic (one-shot, avant démarrage API)..."
  log "Cible : ${POSTGRES_USER:-runflow}@${POSTGRES_HOST:-postgres}:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-runflow}"

  if ! $COMPOSE run --rm --no-deps \
      --entrypoint "" \
      api /app/.venv/bin/alembic upgrade head; then
    log "Diagnostic configuration API :"
    $COMPOSE run --rm --no-deps --entrypoint "" api /app/.venv/bin/python -c \
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
  log "Synchronisation du mot de passe Postgres (${pg_user}) avec .env..."
  $COMPOSE exec -T postgres psql -U "$pg_user" -d postgres \
    -c "ALTER USER ${pg_user} PASSWORD '${pg_password_escaped}';" \
    >/dev/null
  log "Mot de passe Postgres aligné sur .env"
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

main() {
  require_cmd docker
  require_cmd openssl

  if [[ "${1:-}" == "--reset" ]]; then
    log "Reset complet : arrêt des conteneurs et suppression de data/"
    $COMPOSE down --remove-orphans || true
    rm -rf "$ROOT/data"
    shift
  fi

  ensure_env_file
  ensure_generated_secrets
  validate_env

  WORKER_NAME="${WORKER_NAME:-server}"
  WORKER_DIR="$ROOT/data/worker-${WORKER_NAME}"
  WORKER_ENV="$WORKER_DIR/worker.env"

  local fresh_postgres=0
  if [[ ! -f "$ROOT/data/postgres/PG_VERSION" ]]; then
    fresh_postgres=1
  fi

  log "Préparation des répertoires de données..."
  mkdir -p "$ROOT/data/postgres" "$ROOT/data/runflow"
  ensure_worker_stub

  log "Réseau Traefik (proxy)..."
  docker network inspect "${TRAEFIK_NETWORK:-proxy}" >/dev/null 2>&1 \
    || docker network create "${TRAEFIK_NETWORK:-proxy}"

  log "Construction des images runner..."
  "$ROOT/deploy/build-runners.sh"

  log "Build et démarrage de Postgres + Valkey..."
  if [[ $fresh_postgres -eq 1 ]]; then
    log "Nouvelle base Postgres — initialisation..."
    $COMPOSE up -d --force-recreate postgres valkey
  else
    $COMPOSE up -d postgres valkey
  fi
  wait_for_service_healthy runflow_postgres
  wait_for_service_healthy runflow_valkey
  if [[ $fresh_postgres -eq 0 ]]; then
    sync_postgres_password
  fi

  log "Build image API..."
  $COMPOSE build api
  run_db_migrations

  log "Démarrage de l'API..."
  $COMPOSE up -d api
  wait_for_api

  log "Démarrage de l'interface web..."
  $COMPOSE up -d --build web
  ensure_admin
  ensure_worker_credentials

  log "Démarrage du worker..."
  $COMPOSE up -d worker

  log "État des services :"
  $COMPOSE ps

  echo ""
  echo "=============================================="
  echo " RunFlow déployé avec succès"
  echo "=============================================="
  echo " Web  : https://${RUNFLOW_WEB_HOST}"
  echo " API  : https://${RUNFLOW_API_HOST}"
  echo " Admin: ${RUNFLOW_ADMIN_EMAIL:-admin@runflow.local}"
  echo ""
  echo " Worker : ${WORKER_NAME} (réseau interne → http://api:8000)"
  echo " Données: $ROOT/data/"
  echo ""
  echo " Logs   : $COMPOSE logs -f api"
  echo "          : $COMPOSE logs -f worker"
  echo "=============================================="
}

main "$@"
