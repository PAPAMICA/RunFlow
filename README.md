# RunFlow

Plateforme open source self-hosted d'automatisation et d'exécution de jobs orientée API.

**Trigger → Job → Queue → Worker → Runner → Result**

## Stack

- **API** : Python 3.13, FastAPI, SQLAlchemy 2 async, PostgreSQL 17, Valkey
- **Worker** : Python 3.13, asyncio, Docker Engine API
- **Web** : Next.js, TypeScript, Tailwind CSS, Monaco Editor
- **SDK** : `packages/python-sdk` (`from runflow import args, result`)

## Démarrage rapide

```bash
# 1. Configuration
cp .env.example .env

# 2. Build des images runner (contexte = racine du repo)
docker build -f docker/runners/python/Dockerfile -t runflow/runner-python:0.1.0 .
docker build -f docker/runners/bash/Dockerfile -t runflow/runner-bash:0.1.0 .

# 3. Lancement
docker compose up -d --build

# 4. Créer l'admin
docker compose exec api runflow create-admin --email admin@runflow.local
docker compose exec api runflow-seed seed-demo-job

# 5. Créer un worker et l'enregistrer
docker compose exec api runflow worker-create-registration-token --name local-worker --org-id <ORG_ID>
# Sur la machine worker :
# runflow-worker register --server http://localhost:8000 --registration-token rf_reg_...

# 6. Démarrer le worker (token enregistré dans .env)
docker compose up -d worker

# 7. Interface Web
open http://localhost:3000
```

## Test bout en bout (API)

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@runflow.local","password":"YOUR_PASSWORD"}' \
  | jq -r .access_token)

# Créer un job Python de démo
PROJECT_ID=$(curl -s http://localhost:8000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')

JOB=$(curl -s -X POST http://localhost:8000/api/v1/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"project_id\": \"$PROJECT_ID\",
    \"name\": \"Demo Python\",
    \"slug\": \"demo-python\",
    \"runner_type\": \"python\",
    \"entrypoint\": \"main.py\",
    \"parameters\": [{\"name\": \"domain\", \"param_type\": \"string\", \"required\": true}]
  }")
JOB_ID=$(echo $JOB | jq -r .id)

# Écrire le code
curl -s -X PUT "http://localhost:8000/api/v1/jobs/$JOB_ID/files/main.py" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "from runflow import args, result\n\ndomain = args[\"domain\"]\nprint(f\"Checking {domain}\")\nresult.set({\"domain\": domain, \"status\": \"online\"})"}'

# Lancer le job
curl -s -X POST "http://localhost:8000/api/v1/jobs/demo-python/run?wait=true&wait_timeout=60" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"domain": "example.com"}}' | jq
```

## Développement local

```bash
# Installer les dépendances Python
uv sync

# Lancer les tests
uv run pytest

# API en local (nécessite PostgreSQL + Valkey)
cd apps/api && uv run uvicorn runflow_api.main:app --reload

# Web en local
cd apps/web && pnpm install && pnpm dev
```

## Déploiement production (Traefik)

Le déploiement est scindé en deux stacks :

| Stack | Fichier | Rôle |
|-------|---------|------|
| **Serveur** | `deploy/docker-compose.server.yml` | API, Web, Postgres, Valkey |
| **Agents** | `deploy/docker-compose.agents.yml` | Workers d'exécution distants |

Toutes les données sont en **bind mount** sur l'hôte (`data/`), sans volume Docker nommé.

### Serveur (derrière Traefik)

```bash
cp deploy/.env.server.example .env
# Éditer RUNFLOW_WEB_HOST, RUNFLOW_API_HOST, CORS_ORIGINS, NEXT_PUBLIC_API_URL

./deploy/deploy-server.sh
```

Le script `deploy/deploy-server.sh` automatise :
- génération des secrets (JWT, master key, postgres, admin)
- build des runners + stack Docker
- création admin + worker intégré avec token
- options `--logs` (suivi après déploiement) et `--logs-only` (diagnostic sans redéployer)

```bash
./deploy/deploy-server.sh --logs          # déploie puis affiche les logs
./deploy/deploy-server.sh --logs-only     # diagnostic + logs (502, crash, etc.)
./deploy/deploy-server.sh --logs-only web # logs d'un seul service
```

```bash
# Manuel (équivalent)
docker network create proxy
mkdir -p data/postgres data/runflow data/worker-server
./deploy/build-runners.sh
docker compose -f deploy/docker-compose.server.yml up -d --build
```

Traefik expose :
- `https://<RUNFLOW_WEB_HOST>` → interface web (port 3000)
- `https://<RUNFLOW_API_HOST>` → API FastAPI (port 8000)

Labels Traefik calqués sur le modèle Infomaniak (`certresolver=http`, réseau `proxy`).

### Agents (workers distants)

Sur chaque machine capable d'exécuter Docker :

```bash
cp deploy/.env.agents.example .env
# Éditer : RUNFLOW_API_URL, WORKER_NAME

./deploy/build-runners.sh
mkdir -p data/worker-<WORKER_NAME>

# Créer le token côté serveur :
docker compose -f deploy/docker-compose.server.yml exec api \
  runflow worker-create-registration-token --name geneva --org-id <ORG_ID>

# Enregistrer l'agent (une seule fois) :
REGISTRATION_TOKEN=rf_reg_... \
  docker compose -f deploy/docker-compose.agents.yml --profile register run --rm register

# Démarrer le worker
docker compose -f deploy/docker-compose.agents.yml up -d worker
```

Le token permanent est stocké dans `data/worker-<WORKER_NAME>/worker.env` sur l'hôte.

### Développement local (tout-en-un)

```bash
cp .env.example .env
./scripts/setup.sh
```

Utilise `docker-compose.yml` à la racine (ports exposés, worker inclus).

## Architecture

Voir [docs/architecture/decisions/](docs/architecture/decisions/) pour les ADR.

## Documentation

Guide HTML complet (mise en place + utilisation) : ouvrir [`docs/html/index.html`](docs/html/index.html) dans un navigateur.

Documentation Markdown :
- [Triggers](docs/triggers.md) — webhooks, cron, email
- [Workflows](docs/workflows.md) — orchestration DAG
- [Workers](docs/workers.md) — exécution distribuée

## Licence

MIT
