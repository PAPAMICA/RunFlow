# Workers RunFlow

Les workers sont des agents d'exécution pull-based.

## Enregistrement

### 1. Créer un token d'inscription (côté serveur)

```bash
docker compose exec api runflow worker-create-registration-token \
  --name local-worker --org-id <ORG_ID>
```

Le serveur affiche un token `rf_reg_...` (affiché une seule fois).

### 2. Enregistrer le worker (côté agent)

```bash
runflow-worker register \
  --server http://localhost:8000 \
  --registration-token rf_reg_...
```

Le worker reçoit un token permanent `rf_wkr_...` et l'enregistre dans `.env`.

### Alternative : création directe via API

```bash
curl -X POST http://localhost:8000/api/v1/workers \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "remote-worker", "labels": {"docker": "true"}}'
```

## Démarrage

```bash
runflow-worker start
```

Ou via Docker Compose avec `RUNFLOW_WORKER_TOKEN` dans `.env`.

## Fonctionnement

1. Heartbeat périodique vers `/api/v1/worker/heartbeat`
2. Long polling sur `/api/v1/worker/claim` (SKIP LOCKED)
3. Acceptation du run, exécution Docker/Ansible, push logs/résultat

Le serveur ne contacte jamais le worker directement.

## Labels et groupes

Les workers supportent des labels (`docker=true`, `ansible=true`, etc.).

Les jobs peuvent cibler :
- un worker précis (`worker_id`)
- un groupe (`worker_group_id`)
- des labels requis (`worker_labels`)

L'assignation se fait au moment du `claim` via `FOR UPDATE SKIP LOCKED`.
