# ADR 0001: Monorepo avec uv

## Statut
Accepté

## Contexte
RunFlow nécessite plusieurs composants Python (API, worker, SDK) et un frontend Next.js.

## Décision
Utiliser un monorepo à la racine avec uv workspace pour les packages Python et pnpm pour le frontend.

## Conséquences
- Dépendances partagées via `packages/runflow-shared`
- Builds Docker depuis la racine
- Gestion unifiée des versions Python 3.13
