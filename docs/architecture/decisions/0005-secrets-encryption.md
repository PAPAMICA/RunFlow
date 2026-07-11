# ADR 0005: Secrets AES-256-GCM

## Statut
Accepté (prévu Phase 2)

## Contexte
Les secrets et credentials doivent être chiffrés au repos.

## Décision
- Chiffrement AES-256-GCM via `RUNFLOW_MASTER_KEY` externe
- La master key n'est jamais stockée en PostgreSQL
- Injection ciblée par run (pas tous les secrets d'une org)

## Conséquences
- Architecture préparée dès Phase 1 (redaction des logs)
- Implémentation complète en Phase 2
