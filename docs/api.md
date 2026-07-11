# API RunFlow

Base URL : `/api/v1`

## Authentification

- **Web** : `Authorization: Bearer <jwt>`
- **API** : `X-API-Key: rf_live_...`

## Endpoints principaux

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/auth/login` | Connexion web |
| GET | `/jobs` | Liste des jobs |
| POST | `/jobs` | Créer un job |
| POST | `/jobs/{slug}/run` | Lancer un job (202 async) |
| POST | `/jobs/{slug}/run?wait=true` | Lancer et attendre |
| GET | `/runs/{id}` | Statut d'un run |
| GET | `/runs/{id}/logs/stream` | Logs SSE |
| POST | `/api-keys` | Créer une API key |

## Exemple

```bash
curl -X POST http://localhost:8000/api/v1/jobs/demo-python/run \
  -H "X-API-Key: rf_live_..." \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"domain": "example.com"}}'
```
