#!/usr/bin/env bash
# Déploiement complet du serveur RunFlow (Traefik + worker intégré)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -f deploy/docker-compose.server.yml"
ENV_FILE="$ROOT/.env"
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
  openssl rand -base64 32 | tr -d '/+=' | head -c 43
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
  if [[ -z "${POSTGRES_PASSWORD:-}" || "${POSTGRES_PASSWORD}" == change-me* ]]; then
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
  [[ "${RUNFLOW_WEB_HOST}" != *example.com* ]] \
    || die "Configurez RUNFLOW_WEB_HOST dans .env (domaine réel, pas example.com)"
  [[ "${RUNFLOW_API_HOST}" != *example.com* ]] \
    || die "Configurez RUNFLOW_API_HOST dans .env (domaine réel, pas example.com)"
}

wait_for_api() {
  log "Attente de l'API..."
  local i
  for i in $(seq 1 60); do
    if $COMPOSE exec -T api curl -sf http://localhost:8000/health >/dev/null 2>&1; then
      log "API prête"
      return 0
    fi
    sleep 2
  done
  die "L'API n'a pas démarré dans le délai imparti. Vérifiez : $COMPOSE logs api"
}

ensure_admin() {
  local email="${RUNFLOW_ADMIN_EMAIL:-admin@runflow.local}"
  local password="${RUNFLOW_ADMIN_PASSWORD:?RUNFLOW_ADMIN_PASSWORD manquant dans .env}"

  log "Création de l'administrateur (${email}) si nécessaire..."
  if $COMPOSE exec -T api runflow create-admin \
      --email "$email" \
      --password "$password" \
      --org-name "Default Organization" \
      --org-slug default 2>/dev/null; then
    log "Administrateur créé"
  else
    log "Administrateur déjà existant (ok)"
  fi
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
  log "Credentials worker écrits dans $WORKER_ENV"
}

main() {
  require_cmd docker
  require_cmd openssl

  ensure_env_file
  ensure_generated_secrets
  validate_env

  WORKER_NAME="${WORKER_NAME:-server}"
  WORKER_DIR="$ROOT/data/worker-${WORKER_NAME}"
  WORKER_ENV="$WORKER_DIR/worker.env"

  log "Préparation des répertoires de données..."
  mkdir -p "$ROOT/data/postgres" "$ROOT/data/runflow" "$WORKER_DIR"

  log "Réseau Traefik (proxy)..."
  docker network inspect "${TRAEFIK_NETWORK:-proxy}" >/dev/null 2>&1 \
    || docker network create "${TRAEFIK_NETWORK:-proxy}"

  log "Construction des images runner..."
  "$ROOT/deploy/build-runners.sh"

  log "Build et démarrage des services (sans worker)..."
  $COMPOSE up -d --build postgres valkey api web

  wait_for_api
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
