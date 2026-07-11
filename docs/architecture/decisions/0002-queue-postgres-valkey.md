# ADR 0002: Queue PostgreSQL + Valkey

## Statut
Accepté

## Contexte
Les runs doivent être fiables même si Valkey redémarre. Pas de Celery.

## Décision
- PostgreSQL est la source de vérité (statut `queued`)
- Assignation atomique via `SELECT ... FOR UPDATE SKIP LOCKED`
- Valkey notifie les workers (pub/sub)
- Réconciliation périodique republie les runs orphelins

## Conséquences
- Pas de perte de runs si Valkey tombe
- Workers utilisent long polling en fallback
- Pas de double exécution grâce aux locks transactionnels
