# ADR 0003: Worker pull-based

## Statut
Accepté

## Contexte
Les workers peuvent être distants, derrière des firewalls.

## Décision
- Le worker initie toutes les connexions vers l'API (`/api/v1/worker/*`)
- Le serveur ne contacte jamais le worker
- Long polling pour claim des runs (WebSocket ultérieur)
- Token worker hashé en base

## Conséquences
- Pas besoin d'ouvrir de ports entrants sur les workers
- Le worker n'accède pas directement à PostgreSQL/Valkey
