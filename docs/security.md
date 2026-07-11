# Sécurité RunFlow

## Authentification

- **Web** : JWT (HS256), mots de passe Argon2id
- **API** : API Keys hashées SHA-256, prefix public `rf_live_`
- **Workers** : tokens hashés, prefix `rf_wkr_`

## Autorisation

RBAC centralisé : owner, admin, operator, viewer.
Scopes API : `job:read`, `job:run`, `run:read`, `admin`, etc.

## Protection des données

- Secret redaction dans les logs (patterns env + valeurs connues)
- Path traversal protection sur les fichiers jobs
- Pas de `shell=True` avec données utilisateur
- Templates sandboxés (Jinja2 prévu Phase 2)
- Containers de job sans accès au socket Docker

## Secrets (Phase 2)

Chiffrement AES-256-GCM via `RUNFLOW_MASTER_KEY` externe.
