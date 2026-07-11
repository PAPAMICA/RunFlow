# ADR 0004: Isolation Docker

## Statut
Accepté

## Contexte
Les jobs exécutent du code arbitraire.

## Décision
- Seul le worker accède au Docker Engine (socket monté)
- Les containers de job n'ont jamais le socket Docker
- Workspace dédié par run, limites CPU/mémoire, timeout
- Réseau `none` ou `bridge` par défaut (pas `host`)
- Nettoyage des containers après exécution

## Conséquences
- Isolation forte entre jobs
- Mode local (sans Docker) disponible pour le développement
