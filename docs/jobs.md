# Jobs

Un Job représente une unité d'exécution avec un runner type (python, bash, etc.).

## Source interne

Les fichiers sont stockés sous `/data/jobs/{job_id}/` et éditables via l'interface Web (Monaco Editor).

## Paramètres

Chaque job possède un schéma de paramètres validé avant la création du Run.

Les arguments sont injectés via :
- `RUNFLOW_ARGS_FILE=/runflow/input/args.json`
- `RUNFLOW_ARG_<NAME>` (variables d'environnement)

## Résultat structuré

Utiliser le SDK Python :

```python
from runflow import args, result

result.set({"status": "ok"})
```

Parsers disponibles : `none`, `json_stdout`, `last_json_line`, `runflow_sdk`.
