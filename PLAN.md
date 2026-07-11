# PLAN RunFlow

## Statut : Phases 0 à 5 complétées

### Phase 0 - Fondations ✅
- [x] Monorepo uv (apps/api, apps/worker, packages/python-sdk, packages/runflow-shared)
- [x] pnpm pour apps/web
- [x] Docker Compose (postgres 17, valkey, api, worker, web)
- [x] ADR 0001-0006
- [x] App FastAPI de base (/health, /ready, logs JSON)
- [x] Alembic migrations
- [x] CLI Typer (runflow create-admin, version)

### Phase 1 - Core ✅
- [x] Modèle de données (Organization, Project, User, APIKey, Job, JobFile, JobParameter, Worker, Run, RunLog)
- [x] Auth JWT web + API Keys hashées + scopes + RBAC
- [x] CRUD Jobs + fichiers internes multi-fichiers (anti path-traversal)
- [x] JobParameter validation (tous types)
- [x] Machine à états Run + queue Postgres (SKIP LOCKED) + Valkey + réconciliation
- [x] Endpoints worker (/api/v1/worker/*)
- [x] Worker local asyncio (long polling, heartbeat)
- [x] Docker execution (Python + Bash runners)
- [x] Logs persistés + SSE streaming
- [x] Result parsers + SDK Python
- [x] Web UI (Dashboard, Jobs, Job Detail + Monaco + Runs tab + stats, Runs, Run Detail + logs live)
- [x] Composants shadcn/ui (Button, Input, Card)
- [x] Endpoint /metrics Prometheus
- [x] prevent_concurrent_runs
- [x] SDK pré-installé dans image runner Python
- [x] Cache pip persistant (/worker-data/pip-cache)
- [x] Tests pytest

### Phase 2 - Automation ✅
- [x] Webhook triggers (HMAC, bearer, secret header)
- [x] Scheduler / cron (croniter + schedule_locks)
- [x] Callbacks HTTP post-run
- [x] Secrets (AES-256-GCM, RUNFLOW_MASTER_KEY)
- [x] Credentials (SSH, tokens)
- [x] IMAP mailbox + email triggers + pièces jointes
- [x] Moteur de templates Jinja2 sandbox

### Phase 3 - Distributed execution ✅
- [x] Enregistrement workers (token d'inscription + `runflow-worker register`)
- [x] Heartbeat + détection offline
- [x] Labels / groupes + assignation par job
- [x] Runner Ansible
- [x] Inventories
- [x] Git jobs (sync au claim)

### Phase 4 - Workflows ✅
- [x] DAG workflows (nodes, edges)
- [x] Argument mapping Jinja2
- [x] Conditions sur nœuds
- [x] Résultats des jobs précédents
- [x] Exécution parallèle (nœuds sans dépendance)
- [x] API workflows + runs

### Phase 5 - AI ✅
- [x] AI Gateway (OpenAI-compatible, Ollama)
- [x] Providers configurables
- [x] Ask AI panel (Job Detail)
- [x] Multi-file changes + validation + Apply

### Web UI étendue ✅
- [x] Triggers, Secrets, Credentials, Workers, Workflows
- [x] Formulaires de création (triggers, secrets, workflows)
- [x] Ask AI intégré dans l'éditeur de job

## Commandes de vérification

```bash
docker compose up -d --build
docker compose exec api runflow create-admin --email admin@runflow.local
docker compose exec api alembic upgrade head
uv run pytest
cd apps/web && pnpm typecheck && pnpm build
```

## Flux validé

Créer Job Python → multi-fichiers → arguments → API run → queue → worker → Docker → logs SSE → résultat JSON → UI

Automation : webhook / cron / email → trigger → run

Workflows : DAG → exécution séquentielle/parallèle → callbacks

AI : Ask → diff → Apply sur fichiers job
