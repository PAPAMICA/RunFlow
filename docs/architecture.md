# Architecture RunFlow

## Vue d'ensemble

```
Trigger → Job → Queue → Worker → Runner → Result
```

## Composants

| Composant | Rôle |
|-----------|------|
| **API** (FastAPI) | REST API, auth, queue, SSE logs, worker endpoints |
| **Worker** | Long polling, exécution Docker, push logs/résultats |
| **Web** (Next.js) | Interface admin, éditeur Monaco, logs live |
| **PostgreSQL** | Source de vérité (runs, jobs, users) |
| **Valkey** | Notifications queue + pub/sub logs |

## Flux d'exécution

1. Un trigger (manuel, API) crée un `Run` en statut `queued`
2. L'API notifie Valkey
3. Le worker claim le run via `FOR UPDATE SKIP LOCKED`
4. Le worker prépare le workspace, exécute dans Docker
5. Les logs sont poussés par batch vers l'API
6. Le résultat est parsé et stocké
7. L'UI reçoit les logs via SSE

## Sécurité

- JWT (web) + API Keys hashées (API)
- RBAC (owner/admin/operator/viewer)
- Path traversal protection sur les fichiers jobs
- Secret redaction dans les logs
- Isolation Docker (pas de socket dans les containers de job)

## ADR

Voir [decisions/](decisions/) pour les décisions d'architecture détaillées.
