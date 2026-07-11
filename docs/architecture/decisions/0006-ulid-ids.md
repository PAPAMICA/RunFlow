# ADR 0006: Identifiants ULID

## Statut
Accepté

## Contexte
Besoin d'identifiants uniques, triables chronologiquement.

## Décision
Utiliser ULID (26 caractères) pour toutes les entités principales.

## Conséquences
- Tri naturel par date de création
- Pas de collision UUID v4
- Compatible avec les index PostgreSQL
