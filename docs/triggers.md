# Triggers RunFlow

RunFlow supporte plusieurs types de déclencheurs pour lancer des jobs ou workflows.

## Types

| Type | Description |
|------|-------------|
| `webhook` | HTTP POST sur `/api/v1/hooks/{hook_token}` |
| `schedule` | Expression cron (`config.cron`) |
| `email` | Boîte IMAP + règles de matching |
| `manual` | Lancement via UI ou API |
| `workflow` | Déclenché par un nœud de workflow |

## Webhook

Créer un trigger webhook :

```bash
curl -X POST http://localhost:8000/api/v1/triggers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Deploy hook",
    "trigger_type": "webhook",
    "target_id": "<JOB_ID>",
    "config": {"auth": "hmac", "secret": "my-secret"}
  }'
```

Déclencher :

```bash
curl -X POST http://localhost:8000/api/v1/hooks/<HOOK_TOKEN> \
  -H "Content-Type: application/json" \
  -H "X-RunFlow-Signature: sha256=<hmac>" \
  -d '{"branch": "main"}'
```

Modes d'authentification webhook : `none`, `bearer`, `secret_header`, `hmac`.

## Schedule (cron)

```json
{
  "name": "Nightly backup",
  "trigger_type": "schedule",
  "target_id": "<JOB_ID>",
  "config": {"cron": "0 2 * * *", "timezone": "Europe/Paris"}
}
```

Le scheduler vérifie les triggers toutes les minutes et utilise des verrous distribués (`schedule_locks`).

## Email

1. Créer une mailbox IMAP (`POST /api/v1/mailboxes`)
2. Créer un trigger `email` avec `config.match` (expéditeur, sujet, etc.)
3. Le poller IMAP vérifie les boîtes et déclenche les jobs correspondants

Les pièces jointes peuvent être passées comme arguments de job.

## Arguments

Les triggers peuvent mapper le payload entrant vers les arguments du job via des templates Jinja2 dans `config.argument_mapping`.
