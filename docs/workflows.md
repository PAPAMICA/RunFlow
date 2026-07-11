# Workflows RunFlow

Les workflows orchestrent plusieurs jobs en DAG (graphe orienté acyclique).

## Concepts

- **Workflow** : définition (nom, slug, politique d'échec)
- **Node** : référence un job + mapping d'arguments + condition optionnelle
- **Edge** : dépendance `from_node → to_node`
- **WorkflowRun** : exécution d'une instance de workflow

## Création

```bash
curl -X POST http://localhost:8000/api/v1/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "<PROJECT_ID>",
    "name": "Deploy pipeline",
    "slug": "deploy-pipeline",
    "on_failure": "stop",
    "nodes": [
      {"job_id": "<BUILD_JOB>", "slug": "build", "position": 0},
      {"job_id": "<TEST_JOB>", "slug": "test", "position": 1, "argument_mapping": {"version": "{{ nodes.build.result.version }}"}}
    ],
    "edges": [
      {"from_node_id": "<BUILD_NODE_ID>", "to_node_id": "<TEST_NODE_ID>"}
    ]
  }'
```

## Argument mapping

Les expressions Jinja2 dans `argument_mapping` ont accès à :

- `workflow.arguments` — arguments passés au lancement
- `nodes.<slug>.result` — résultat JSON du job du nœud
- `nodes.<slug>.status` — statut du run

## Conditions

Un nœud peut définir `condition` (ex. `nodes.build.status == "success"`). Si la condition est fausse, le nœud est ignoré (`skipped`).

## Exécution

```bash
curl -X POST http://localhost:8000/api/v1/workflows/<WORKFLOW_ID>/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"env": "production"}}'
```

## Parallélisme

Les nœuds sans dépendance commune s'exécutent en parallèle. Le moteur réévalue le DAG à chaque fin de run enfant.

## Politique d'échec

- `stop` — arrête le workflow au premier échec
- `continue` — continue les branches indépendantes
