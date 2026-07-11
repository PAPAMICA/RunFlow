# Mission

Tu es un Staff Software Engineer / Software Architect expert en Python, FastAPI, Next.js, PostgreSQL, Valkey, Docker, systèmes distribués et plateformes d'automatisation.

Tu dois concevoir et développer une application open source self-hosted provisoirement nommée **RunFlow**.

RunFlow est une plateforme d'automatisation et d'exécution de jobs orientée API.

L'objectif n'est PAS de créer un clone de Rundeck, Semaphore ou Jenkins.

RunFlow doit être une couche universelle permettant à des API, webhooks, e-mails, crons, utilisateurs et agents IA de déclencher des scripts et automatisations de manière contrôlée.

Concept principal :

Trigger → Job / Workflow → Queue → Worker → Runner → Result

L'application doit être moderne, simple à administrer, API-first et pensée pour être utilisée par des agents IA.

---

# Règles générales de développement

Avant de coder :

1. Analyse le besoin complet.
2. Inspecte l'intégralité du repository existant.
3. Crée ou mets à jour un fichier `PLAN.md`.
4. Définis les étapes d'implémentation.
5. Implémente les fonctionnalités progressivement.
6. Ne crée jamais de pseudo-code.
7. Le code doit être entièrement fonctionnel.
8. Ne laisse pas de TODO pour une fonctionnalité annoncée comme terminée.
9. Ajoute les migrations nécessaires.
10. Ajoute les tests pertinents.
11. Mets à jour la documentation après chaque changement majeur.
12. Vérifie que les containers buildent.
13. Vérifie les imports Python.
14. Vérifie les types TypeScript.
15. Vérifie les migrations Alembic.
16. Ne casse jamais une fonctionnalité existante sans raison documentée.

Lorsque tu rencontres une décision d'architecture importante :

* analyse les options ;
* sélectionne la solution la plus simple et maintenable ;
* documente la décision dans `docs/architecture/decisions/`.

Utilise des ADR simples.

Ne me demande pas confirmation pour chaque fichier.

Prends les décisions techniques raisonnables de manière autonome.

Si une information manque réellement et bloque l'implémentation, pose une question précise.

---

# Philosophie du projet

RunFlow doit rester simple.

Éviter les abstractions inutiles.

Principes :

* PostgreSQL est la source de vérité.
* Valkey est utilisé comme queue et pour les événements temporaires.
* Les workers doivent être stateless autant que possible.
* Les workers initient toujours les connexions vers le serveur.
* Le serveur central ne doit pas avoir besoin d'accéder directement aux workers.
* Un agent IA ne doit jamais avoir besoin d'un accès SSH root.
* Un agent IA appelle uniquement des jobs autorisés via l'API.
* Les jobs doivent avoir des paramètres explicitement définis.
* Les résultats doivent pouvoir être structurés en JSON.
* Tous les runs doivent être auditables.
* Tous les logs doivent être consultables.
* Les secrets ne doivent jamais apparaître dans les logs.
* La sécurité doit être intégrée dès la conception.

Le projet doit pouvoir fonctionner sur une seule machine avec Docker Compose.

Il doit également permettre l'ajout de workers distants.

Volume initial attendu :

* 50 jobs
* 100 runs par jour
* 5 runs simultanés
* durée habituelle maximale d'un job : 5 minutes

L'architecture doit néanmoins pouvoir évoluer.

---

# Stack technique imposée

## Monorepo

Utiliser un monorepo.

Structure cible :

runflow/
├── apps/
│   ├── api/
│   ├── worker/
│   └── web/
├── packages/
│   └── python-sdk/
├── docker/
│   └── runners/
├── docs/
│   └── architecture/
│       └── decisions/
├── migrations/
├── docker-compose.yml
├── .env.example
├── PLAN.md
└── README.md

Tu peux adapter légèrement cette structure si une justification technique existe.

## Backend

* Python 3.13
* FastAPI
* Pydantic v2
* SQLAlchemy 2 async
* Alembic
* PostgreSQL 17
* Valkey
* asyncio

Ne pas utiliser Celery.

## Frontend

* Next.js
* TypeScript strict
* Tailwind CSS
* shadcn/ui
* Monaco Editor

React Flow pourra être utilisé ultérieurement pour l'éditeur visuel de workflows.

## Worker

* Python 3.13
* asyncio
* Docker Engine API ou Docker SDK Python lorsque pertinent
* communication sortante uniquement vers l'API RunFlow

## Live logs

Utiliser SSE pour transmettre les logs en temps réel au navigateur.

## Git

Utiliser principalement le CLI Git.

## Authentication

* JWT pour l'interface Web
* API Keys pour l'API
* API Keys hashées en base
* permissions/scopes

## Secrets

* AES-256-GCM
* master key externe via `RUNFLOW_MASTER_KEY`
* la master key ne doit jamais être stockée en PostgreSQL

---

# Architecture fonctionnelle

Les principaux objets sont :

* User
* Organization
* Project
* Job
* JobFile
* JobParameter
* Worker
* WorkerLabel
* WorkerGroup
* Run
* RunLog
* RunArtifact
* Trigger
* WebhookTrigger
* EmailTrigger
* ScheduleTrigger
* Mailbox
* EmailMessage
* Secret
* Credential
* Inventory
* Workflow
* WorkflowNode
* WorkflowEdge
* WorkflowRun
* Callback
* APIKey
* AIProvider

Toutes les ressources importantes doivent appartenir à une Organization.

Un Project appartient à une Organization.

Un Job appartient à un Project.

---

# Jobs

Un Job représente une unité d'exécution.

Exemples :

* script Python
* script Bash
* playbook Ansible
* commande Docker
* Docker Compose
* commande arbitraire
* Terraform
* OpenTofu

Un Job doit contenir au minimum :

* id ULID ou UUID
* organization_id
* project_id
* name
* slug
* description
* runner_type
* source_type
* entrypoint
* timeout
* concurrency_limit
* prevent_concurrent_runs
* enabled
* created_at
* updated_at

Runner types initiaux :

* python
* bash
* ansible
* docker
* docker_compose
* command
* terraform
* opentofu

Concevoir une architecture extensible.

Créer une interface Runner commune.

Exemple conceptuel :

class BaseRunner:
async def prepare(...)
async def execute(...)
async def cleanup(...)

Implémenter les runners dans des modules séparés.

---

# Sources des jobs

Deux sources principales.

## Internal

Le code est créé et modifié depuis l'interface Web.

Support multi-fichiers.

Exemple :

main.py
requirements.txt
lib/company.py
templates/report.md

L'interface doit permettre :

* créer un fichier
* créer un dossier
* modifier un fichier
* renommer
* supprimer
* naviguer dans l'arborescence

Utiliser Monaco Editor.

Pour le MVP, aucun historique de version complexe n'est nécessaire.

Les fichiers peuvent être stockés dans un volume persistant.

Exemple :

/data/jobs/{job_id}/

Protéger strictement contre les path traversals.

## Git

Un Job peut utiliser un repository Git.

Configuration :

* repository URL
* branch
* path
* entrypoint
* credential optionnel

Utiliser un cache Git local.

Exemple :

/data/git-cache/{repository_hash}/

Avant l'exécution :

* git fetch
* checkout de la branche
* reset vers origin/branch

Ne jamais exécuter directement depuis le cache partagé.

Créer un workspace isolé pour chaque run.

---

# Paramètres des jobs

Les jobs possèdent un schéma de paramètres.

Types à supporter :

* string
* integer
* float
* boolean
* select
* multi_select
* secret
* json
* file
* date
* datetime
* email
* url
* ip
* cidr
* raw

Chaque paramètre peut avoir :

* name
* label
* description
* type
* required
* default
* options
* validation

Exemple :

{
"domain": {
"type": "string",
"required": true
},
"environment": {
"type": "select",
"options": ["production", "preproduction"]
},
"force": {
"type": "boolean",
"default": false
}
}

Les arguments doivent être validés avant la création du Run.

Les arguments doivent être accessibles :

* via un SDK Python RunFlow ;
* via variables d'environnement ;
* éventuellement via un fichier JSON monté dans le workspace.

Créer :

RUNFLOW_ARGS_FILE=/runflow/input/args.json

Pour les variables d'environnement, utiliser un préfixe clair :

RUNFLOW_ARG_DOMAIN

Ne pas injecter automatiquement des structures JSON complexes directement dans l'environnement sans sérialisation contrôlée.

---

# API d'exécution

Créer une API REST versionnée :

/api/v1/

Endpoint :

POST /api/v1/jobs/{job_slug}/run

Authentification API Key.

Payload :

{
"arguments": {
"domain": "example.com"
}
}

Mode async par défaut.

Retour HTTP 202 :

{
"run_id": "...",
"status": "queued"
}

Endpoint :

GET /api/v1/runs/{run_id}

Retour :

{
"id": "...",
"status": "success",
"exit_code": 0,
"duration": 7.41,
"result": {},
"created_at": "...",
"started_at": "...",
"finished_at": "..."
}

Supporter :

POST /api/v1/jobs/{job_slug}/run?wait=true

L'API attend la fin du job.

Supporter un timeout d'attente HTTP.

Exemple :

?wait=true&wait_timeout=30

Si le job n'est pas terminé :

HTTP 202

{
"run_id": "...",
"status": "running"
}

Ne jamais tuer le job simplement parce que le timeout HTTP est atteint.

---

# Résultats structurés

Un Run possède :

* stdout
* stderr
* exit_code
* result JSON
* error

Supporter plusieurs result parsers :

* none
* json_stdout
* last_json_line
* runflow_sdk

Créer un SDK Python minimal.

Exemple :

from runflow import args, result

domain = args["domain"]

print(f"Checking {domain}")

result.set({
"domain": domain,
"status": "online"
})

Le SDK doit communiquer le résultat au runner de manière robuste.

Privilégier un fichier dédié dans le workspace.

Exemple :

RUNFLOW_RESULT_FILE=/runflow/output/result.json

Le SDK écrit atomiquement ce fichier.

Le runner valide le JSON avant stockage.

---

# Runs

Statuts possibles :

* queued
* assigned
* preparing
* running
* success
* failed
* timeout
* cancelled
* skipped

Stocker :

* id
* job_id
* worker_id
* trigger_type
* trigger_id
* arguments
* status
* queued_at
* assigned_at
* started_at
* finished_at
* duration
* exit_code
* result
* error
* workspace metadata

Créer une machine à états explicite.

Interdire les transitions de statut invalides.

Documenter les transitions.

---

# Logs

Les logs doivent être transmis en temps réel.

Chaque ligne possède :

* run_id
* timestamp
* sequence
* stream
* message

Streams :

* stdout
* stderr
* system

Les logs doivent être persistés.

Le navigateur utilise :

GET /api/v1/runs/{run_id}/logs/stream

SSE.

Lors de la connexion :

1. envoyer les logs historiques ;
2. continuer avec les nouveaux logs ;
3. envoyer les changements de statut ;
4. terminer proprement lorsque le Run est terminé.

Gérer les reconnexions SSE.

Utiliser les séquences ou Last-Event-ID pour éviter les doublons.

Créer une interface de visualisation type terminal.

Afficher :

* timestamp
* stream
* message

Prévoir une recherche dans les logs.

Les secrets connus doivent être masqués avant stockage et avant diffusion.

Exemple :

CLOUDFLARE_API_TOKEN=abcd1234

doit devenir :

CLOUDFLARE_API_TOKEN=********

Créer un service central de secret redaction.

---

# Historique

Créer une page Runs.

Filtres :

* status
* job
* worker
* trigger type
* date

Afficher :

* job
* status
* started_at
* duration
* worker
* trigger

Créer une page de détail d'un Run.

Afficher :

* informations générales
* arguments en masquant les secrets
* logs
* result JSON
* erreur
* worker
* trigger
* durée

Créer une page Job avec :

* nombre de runs
* success rate
* durée moyenne
* dernier run
* dernier échec

Afficher un historique temporel simple.

---

# Queue

Ne pas utiliser Celery.

PostgreSQL reste la source de vérité.

Valkey est utilisé pour signaler rapidement les nouveaux Runs aux workers.

Concevoir une queue simple.

Le système doit être robuste si Valkey redémarre.

Un Run présent en PostgreSQL avec le statut queued ne doit pas être perdu.

Créer un mécanisme de reconciliation périodique.

Le scheduler ou un service de reconciliation doit republier les Runs queued qui ne sont pas pris en charge.

Éviter les doubles exécutions.

Utiliser des locks PostgreSQL ou un mécanisme transactionnel d'assignation.

Documenter précisément le modèle d'atomicité.

---

# Workers

Un worker est un agent distant.

Il initie toujours la connexion vers RunFlow.

Le serveur RunFlow ne contacte jamais directement le worker.

Un worker possède :

* id
* name
* token
* hostname
* status
* last_seen_at
* version
* max_concurrency
* labels

Exemple de labels :

location=geneva
customer=genevois
docker=true
ansible=true

Modes de sélection d'un worker :

* specific worker
* worker group
* labels
* any compatible worker

Le worker doit envoyer un heartbeat.

Le serveur doit détecter les workers offline.

Le token worker doit être hashé en base.

Prévoir un système d'enregistrement sécurisé.

Exemple :

runflow worker register --server URL --registration-token TOKEN --name worker-geneva

Le serveur retourne une credential worker affichée une seule fois.

Le worker stocke localement son token.

Pour le MVP, le worker peut utiliser un système de long polling HTTP.

Concevoir l'architecture pour permettre WebSocket ultérieurement.

Endpoints worker séparés :

/api/v1/worker/

Le worker doit pouvoir :

* heartbeat
* demander un Run
* accepter un Run
* envoyer les logs
* envoyer le résultat
* signaler un échec

Les endpoints worker doivent utiliser une authentification spécifique.

---

# Isolation

Un job peut être exécuté :

* localement sur le worker ;
* dans Docker.

Docker doit être le mode recommandé.

Pour Docker :

* workspace dédié
* filesystem temporaire
* limites CPU configurables
* limites mémoire configurables
* timeout
* secrets montés en lecture seule
* nettoyage après exécution
* réseau configurable

Ne jamais monter le Docker socket dans un container de job.

Seul le worker peut accéder au Docker Engine.

Ajouter une option :

network_mode

Valeurs initiales :

* none
* bridge

Ne pas autoriser host par défaut.

Prévoir une allowlist administrateur pour les modes sensibles.

---

# Python Runner

Le Python Runner doit pouvoir exécuter :

main.py

Si requirements.txt existe :

créer un environnement d'exécution adapté.

Pour le MVP Docker, créer une image runner Python générique.

Le runner prépare un virtualenv dans le workspace ou un cache de dépendances.

Choisir une stratégie simple et documentée.

Éviter de faire `pip install` inutilement à chaque exécution lorsque requirements.txt n'a pas changé.

Créer un hash de requirements.txt pour le cache.

Utiliser pip.

Les images runner doivent être configurables.

---

# Bash Runner

Exécuter le script configuré.

Utiliser Bash explicitement.

Les arguments sont accessibles via :

* RUNFLOW_ARGS_FILE
* variables RUNFLOW_ARG_*

Capturer stdout et stderr séparément.

---

# Command Runner

Permettre l'exécution d'une commande prédéfinie dans le Job.

Ne jamais construire une commande shell en concaténant directement les arguments utilisateur.

Utiliser une liste argv lorsque possible.

Créer une configuration explicite de mapping des arguments.

Exemple :

command:
nmap

argv:

* "-sV"
* "{{ args.target }}"

Valider les templates avant exécution.

---

# Ansible

Supporter les playbooks Ansible.

Configuration Job :

* playbook
* inventory
* extra vars
* credential
* tags
* skip tags

Les inventories peuvent être :

* internal
* git
* dynamic

Internal :

contenu inventory géré dans l'application.

Git :

repository + path.

Dynamic :

résultat JSON d'un Job.

Supporter les credentials SSH.

Injecter :

ANSIBLE_PRIVATE_KEY_FILE

La clé doit être écrite dans un espace temporaire sécurisé.

Permissions :

0600

Suppression après exécution.

Les extra vars doivent être passées via un fichier JSON temporaire plutôt qu'une longue ligne de commande.

---

# Credentials

Créer un objet Credential séparé des Secrets.

Types initiaux :

* ssh_private_key
* username_password
* api_token
* aws
* azure
* custom

Les données sensibles sont chiffrées avec AES-256-GCM.

Les credentials peuvent appartenir à :

* organization
* project

Un Job peut référencer plusieurs credentials si nécessaire.

Ne jamais retourner les valeurs sensibles via l'API après création.

Retourner uniquement :

{
"configured": true
}

---

# Secrets

Scopes :

* global
* organization
* project
* job
* worker

Syntaxe de template :

{{ secrets.CLOUDFLARE_API_TOKEN }}

Les secrets peuvent être injectés :

* comme variable d'environnement ;
* comme fichier ;
* dans un template.

Supporter également :

$CLOUDFLARE_API_TOKEN

lorsqu'un secret est injecté comme variable d'environnement.

Créer un moteur de résolution avec priorité :

job
project
organization
global

Les secrets worker restent uniquement disponibles pour les jobs exécutés sur ce worker.

Le serveur doit transmettre uniquement les secrets nécessaires au Run.

Ne jamais transmettre tous les secrets d'une organization.

---

# Triggers

Créer une abstraction Trigger.

Types :

* manual
* api
* webhook
* schedule
* email
* workflow

Un Trigger peut déclencher :

* un Job ;
* un Workflow.

Chaque déclenchement crée une trace d'audit.

---

# Webhooks

Créer un endpoint webhook unique par Trigger.

Exemple :

POST /api/v1/hooks/{hook_token}

Le hook token doit être aléatoire et non prédictible.

Supporter :

* secret header
* bearer token
* HMAC SHA-256

Le webhook reçoit un payload JSON.

Permettre de mapper les données vers les arguments.

Exemple :

{
"name": "{{ webhook.body.name }}",
"email": "{{ webhook.body.email }}",
"company": "{{ webhook.body.company }}"
}

Créer un moteur de template simple et sécurisé.

Ne pas utiliser eval.

Utiliser Jinja2 SandboxedEnvironment ou une solution équivalente.

---

# Cron et Scheduler

Créer des Schedule Triggers.

Deux modes UI :

* simple
* advanced cron

Simple :

* every X minutes
* hourly
* daily
* weekly
* monthly

Advanced :

expression cron.

Support timezone.

Exemple :

Europe/Paris

Options :

* prevent concurrent execution
* timeout
* retries
* retry delay
* maximum retries
* misfire policy

Misfire policies :

* skip
* run_immediately
* run_once

Le scheduler doit être PostgreSQL backed.

Éviter qu'une exécution soit créée deux fois si plusieurs instances API existent.

Utiliser PostgreSQL advisory locks ou une stratégie transactionnelle équivalente.

---

# Email Triggers

L'application doit pouvoir surveiller des boîtes e-mail.

Créer une abstraction EmailProvider.

Providers prévus :

* IMAP
* Microsoft Graph
* Gmail

Implémenter IMAP en premier.

Les autres providers doivent être prévus dans l'architecture sans être nécessairement implémentés immédiatement.

Une Mailbox possède :

* name
* provider
* configuration
* credential
* enabled
* polling_interval
* last_check_at

Un Email Trigger contient des conditions.

Champs disponibles :

* FROM
* TO
* CC
* SUBJECT
* BODY
* ATTACHMENT_NAME
* HAS_ATTACHMENT
* HEADER

Opérateurs :

* equals
* not_equals
* contains
* not_contains
* starts_with
* ends_with
* regex
* exists

Supporter AND et OR.

Ne pas créer immédiatement un moteur de règles excessivement complexe.

Utiliser une structure JSON claire.

Exemple :

{
"operator": "AND",
"conditions": [
{
"field": "FROM",
"operator": "contains",
"value": "@client.com"
},
{
"field": "SUBJECT",
"operator": "regex",
"value": "^[INCIDENT\]"
}
]
}

Variables disponibles :

{{ email.from }}
{{ email.to }}
{{ email.cc }}
{{ email.subject }}
{{ email.body }}
{{ email.body_text }}
{{ email.body_html }}
{{ email.message_id }}
{{ email.received_at }}
{{ email.attachments }}

Les attachments doivent pouvoir être transmis au Run.

Créer un input directory :

/runflow/input/

Les pièces jointes sont copiées dans cet espace.

Créer une représentation structurée des attachments.

Exemple :

[
{
"name": "servers.csv",
"path": "/runflow/input/attachments/servers.csv",
"content_type": "text/csv",
"size": 1234
}
]

Sécuriser les noms de fichiers.

Anti double exécution obligatoire.

Stocker :

* mailbox_id
* provider_message_id
* trigger_id

Créer une contrainte unique.

Modes :

* once_per_message
* once_per_thread
* always

Le mode par défaut est once_per_message.

Ne jamais marquer obligatoirement un mail comme lu.

Cette action doit être configurable.

---

# Workflows

Un Workflow est un DAG de Jobs.

Objets :

* Workflow
* WorkflowNode
* WorkflowEdge
* WorkflowRun

Un Node référence un Job.

Chaque Node possède un mapping d'arguments.

Exemple :

{
"domain": "{{ jobs.analyse_domain.result.domain }}"
}

Les résultats des jobs précédents sont disponibles :

{{ jobs.NODE_SLUG.result }}

Supporter :

* exécution séquentielle
* exécution parallèle
* conditions
* DAG

Pour la première interface, ne pas créer immédiatement un éditeur graphique complexe.

Créer une interface simple permettant :

* ajouter un node
* sélectionner un Job
* définir les arguments
* définir les dépendances
* définir une condition

Les conditions doivent être simples et sécurisées.

Ne pas utiliser eval.

Exemples :

jobs.check.status == "success"

jobs.check.result.cms == "wordpress"

Créer un moteur de conditions limité.

Le scheduler de workflow doit détecter les nodes exécutables lorsque toutes leurs dépendances sont terminées.

Un échec doit pouvoir appliquer une policy :

* stop
* continue

---

# Callbacks

Un Job, Workflow ou Trigger peut définir un callback HTTP.

Après terminaison :

POST callback_url

Payload :

{
"run_id": "...",
"status": "success",
"result": {}
}

Supporter :

* Bearer Token
* HMAC SHA-256

Créer un système de retry.

Stocker les tentatives.

Ne pas bloquer la terminaison du Run si le callback échoue.

---

# API Keys

Créer des API Keys.

Exemples :

* Cursor
* Agent WordPress
* Zabbix
* Client A

Une API Key possède des scopes.

Scopes initiaux :

* job:read
* job:run
* run:read
* workflow:read
* workflow:run
* admin

Permettre de restreindre une API Key à :

* organization
* project
* jobs spécifiques

La clé complète est affichée une seule fois.

Stocker uniquement son hash.

Conserver un prefix public pour identifier la clé.

Exemple :

rf_live_abcd...

---

# Authentification Web

Créer une authentification locale simple.

User :

* email
* password_hash
* enabled

Supporter les Organizations.

Rôles initiaux :

* owner
* admin
* operator
* viewer

Créer une matrice de permissions claire.

Ne pas coder les vérifications de permission directement dans chaque endpoint.

Créer un système central de authorization.

---

# Interface Web

Créer une interface moderne orientée administration technique.

Pages principales :

Dashboard
Projects
Jobs
Workflows
Runs
Triggers
Workers
Inventories
Secrets
Credentials
API Keys
Settings

## Dashboard

Afficher :

* runs aujourd'hui
* success rate
* running jobs
* failed jobs
* online workers
* recent runs

## Jobs

Liste avec :

* name
* project
* runner
* source
* last run
* status

## Job Detail

Tabs :

Overview
Code
Parameters
Triggers
Runs
Settings

## Code

Arborescence à gauche.

Monaco Editor au centre.

Support multi-fichiers.

Actions :

New File
New Folder
Rename
Delete
Save

## Run Job

Créer automatiquement un formulaire basé sur les JobParameters.

Afficher les types adaptés.

Exemple :

boolean → switch
select → select
json → editor JSON
secret → password
file → upload

## Run Detail

Afficher :

* status
* job
* worker
* trigger
* timestamps
* duration
* arguments
* logs live
* result JSON
* error

Les logs doivent ressembler à un terminal.

## Workers

Afficher :

* online/offline
* hostname
* version
* labels
* running jobs
* last heartbeat

---

# IA dans l'éditeur

Prévoir une intégration IA.

Créer un AI Gateway abstrait.

Providers prévus :

* OpenAI
* Anthropic
* OpenRouter
* Ollama
* OpenAI compatible API

Ne pas coupler directement l'éditeur à un provider.

Créer une interface commune.

Un AIProvider contient :

* provider type
* name
* base URL optionnelle
* model
* encrypted API key
* enabled

Dans l'éditeur de Job, ajouter un panneau Ask AI.

L'utilisateur peut écrire :

"Ajoute un timeout de 10 secondes aux requêtes HTTP et retourne un JSON structuré."

Le contexte transmis à l'IA peut contenir :

* metadata du Job
* runner type
* parameters schema
* file tree
* contenu des fichiers nécessaires
* fichier sélectionné

Supporter les modifications multi-fichiers.

Le provider doit retourner une structure contrôlée.

Exemple :

{
"changes": [
{
"path": "main.py",
"content": "..."
},
{
"path": "requirements.txt",
"content": "..."
}
]
}

Valider strictement la réponse.

Afficher un diff avant application.

Actions :

Apply
Cancel

Ne jamais appliquer automatiquement les changements IA sans action utilisateur.

Protéger contre les path traversals dans les paths retournés par l'IA.

L'intégration IA peut être implémentée après le core mais l'architecture doit la prévoir.

---

# Audit

Créer un AuditLog.

Auditer au minimum :

* login
* création Job
* modification Job
* suppression Job
* lancement manuel
* lancement API
* création API Key
* suppression API Key
* création Secret
* modification Secret
* création Credential
* modification Credential
* worker registration

Stocker :

* organization_id
* user_id
* api_key_id
* action
* resource_type
* resource_id
* metadata
* ip
* created_at

Ne jamais stocker de secrets dans metadata.

---

# Sécurité

La sécurité est prioritaire.

Implémenter :

* validation stricte Pydantic
* RBAC
* API scopes
* secret encryption
* secret redaction
* path traversal protection
* command injection protection
* webhook authentication
* rate limiting sur les endpoints sensibles
* password hashing moderne
* API Key hashing
* Worker Token hashing
* audit logs

Utiliser Argon2id pour les mots de passe lorsque possible.

Les templates doivent être sandboxés.

Ne jamais utiliser Python eval.

Ne jamais utiliser shell=True avec des données utilisateur non contrôlées.

Les fichiers secrets temporaires doivent avoir des permissions restrictives.

Les containers doivent être supprimés après exécution.

Prévoir un garbage collector pour les workspaces abandonnés.

---

# Observabilité

Créer :

GET /health
GET /ready

Ajouter des logs JSON structurés pour l'API et le worker.

Inclure :

* timestamp
* level
* service
* run_id lorsque disponible
* worker_id lorsque disponible
* message

Prévoir des métriques Prometheus.

Endpoint :

/metrics

Métriques minimales :

runflow_runs_total
runflow_runs_running
runflow_run_duration_seconds
runflow_workers_online
runflow_queue_depth

---

# Docker Compose

Créer un environnement complet.

Services :

postgres
valkey
api
worker
web

Volumes persistants :

postgres_data
runflow_data
worker_data

Ajouter les healthchecks.

Utiliser des versions d'images explicites lorsque possible.

Créer `.env.example`.

Le lancement doit être aussi simple que :

docker compose up -d --build

Puis :

docker compose exec api runflow create-admin

Ou une commande équivalente documentée.

---

# CLI

Créer une CLI Python pour l'administration.

Commande :

runflow

Sous-commandes initiales :

runflow create-admin
runflow worker create-registration-token
runflow secret rotate-master-key -- uniquement si implémenté correctement
runflow version

Pour le worker :

runflow-worker register
runflow-worker start
runflow-worker version

Utiliser Typer.

---

# Tests

Backend :

pytest

Tester au minimum :

* Job parameter validation
* Run state transitions
* API Key authentication
* API Key scopes
* secret encryption/decryption
* secret redaction
* path traversal protection
* webhook HMAC
* email trigger matching
* email duplicate prevention
* scheduler duplicate prevention
* worker assignment
* result parser
* workflow dependency resolution

Frontend :

ajouter les tests utiles pour les composants critiques.

Ne pas chercher une couverture artificielle de 100 %.

Tester les fonctions présentant un risque métier ou sécurité.

---

# Documentation

README principal avec :

* présentation
* architecture
* installation
* premier démarrage
* création admin
* création Job
* lancement API
* workers distants

Créer :

docs/architecture.md
docs/jobs.md
docs/workers.md
docs/triggers.md
docs/email-triggers.md
docs/workflows.md
docs/secrets.md
docs/api.md
docs/security.md

Documenter des exemples réels.

---

# Cas d'usage à utiliser pour valider le produit

## Cas 1 : rendez-vous reçu

Un webhook de prise de rendez-vous envoie :

{
"name": "Jean Dupont",
"email": "[jean@example.com](mailto:jean@example.com)",
"company": "Example SA"
}

Un Workflow est lancé.

Étapes :

analyse-contact
analyse-domain
check-dns
check-wordpress
generate-report

Le résultat final est un JSON structuré.

## Cas 2 : e-mail reçu

Une mailbox IMAP reçoit un mail.

Conditions :

FROM contient `client@example.com`

SUBJECT contient `migration`

Le Workflow suivant est exécuté :

parse-email
analyse-domain
check-dns
check-wordpress

Le body du mail et les attachments sont disponibles.

## Cas 3 : cron

Tous les jours à 10:00 Europe/Paris.

Lancer un Job.

Le Job ne doit pas être lancé deux fois même si plusieurs instances API existent.

## Cas 4 : agent IA

Une API Key `Agent WordPress` peut uniquement exécuter :

check-wordpress
update-wordpress

L'agent appelle :

POST /api/v1/jobs/check-wordpress/run?wait=true

Il récupère un résultat JSON.

Il ne possède aucun accès SSH.

## Cas 5 : Ansible distant

Un Job Ansible est assigné à un worker ayant :

location=geneva
ansible=true

Le worker récupère :

* playbook Git
* inventory
* credential SSH nécessaire

Il exécute le playbook.

Les logs sont visibles en temps réel.

Le résultat est retourné par l'API.

---

# Ordre d'implémentation obligatoire

Ne tente pas de tout développer simultanément.

## Phase 0

* analyse
* PLAN.md
* architecture
* ADR initiaux
* monorepo
* Docker Compose
* PostgreSQL
* Valkey

## Phase 1 : Core

* authentication
* organizations
* projects
* jobs
* job parameters
* internal multi-file jobs
* Python Runner
* Bash Runner
* runs
* queue
* worker local
* Docker execution
* logs
* SSE
* async Run API
* sync Run API
* structured results

Créer un environnement réellement fonctionnel avant de continuer.

Créer un Job Python de démonstration et l'exécuter de bout en bout.

## Phase 2 : Automation

* webhook triggers
* scheduler
* cron
* callbacks
* secrets
* credentials
* IMAP mailbox
* email triggers
* attachments

Valider les trois cas :

webhook
cron
email

## Phase 3 : Distributed execution

* remote workers
* worker registration
* heartbeat
* labels
* groups
* assignment
* Ansible
* inventories
* Git jobs

## Phase 4 : Workflows

* sequential workflows
* argument mapping
* previous job results
* dependencies
* conditions
* parallel execution
* DAG

## Phase 5 : AI

* AI Gateway
* providers
* Ask AI
* multi-file changes
* diff
* Apply

---

# Méthode de travail attendue

Commence maintenant par :

1. inspecter le repository ;
2. créer `PLAN.md` ;
3. créer les ADR nécessaires ;
4. définir le schéma d'architecture ;
5. définir le modèle de données initial ;
6. initialiser le monorepo ;
7. créer le Docker Compose ;
8. implémenter uniquement la Phase 0 puis la Phase 1.

Ne commence PAS les Email Triggers, Workflows ou l'IA tant que le flux suivant n'est pas totalement fonctionnel :

Créer Job Python
↓
Ajouter plusieurs fichiers
↓
Définir des arguments
↓
Lancer via API
↓
Créer un Run
↓
Mettre en queue
↓
Assigner à un Worker
↓
Exécuter dans Docker
↓
Streamer stdout/stderr
↓
Afficher les logs en SSE
↓
Récupérer le résultat JSON
↓
Afficher le Run dans l'interface Web

Lorsque la Phase 1 est fonctionnelle :

* exécute les tests ;
* build tous les containers ;
* vérifie le démarrage Docker Compose ;
* documente les problèmes éventuels ;
* mets à jour PLAN.md ;
* fournis-moi un résumé précis de ce qui fonctionne réellement ;
* indique les commandes exactes permettant de tester le flux de bout en bout.

Commence l'implémentation maintenant.
