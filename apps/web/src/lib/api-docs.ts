export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface ApiRouteDoc {
  method: HttpMethod;
  path: string;
  summary: string;
  permission?: string;
  auth: "user" | "api_key" | "worker" | "public" | "hook";
  query?: string;
  body?: string;
  response?: string;
}

export interface ApiRouteGroup {
  id: string;
  title: string;
  description: string;
  routes: ApiRouteDoc[];
}

export const API_SCOPE_PRESETS = [
  {
    id: "cicd",
    label: "CI/CD",
    description: "Lancer des jobs et suivre les runs",
    scopes: ["job:run", "run:read"],
  },
  {
    id: "readonly",
    label: "Lecture seule",
    description: "Consulter jobs, runs et workflows",
    scopes: ["job:read", "run:read", "workflow:read"],
  },
  {
    id: "admin",
    label: "Accès complet",
    description: "Toutes les permissions via clé API",
    scopes: ["admin"],
  },
] as const;

export const API_SCOPES = [
  {
    id: "job:read",
    label: "job:read",
    description: "Lire les jobs et leurs métadonnées",
  },
  {
    id: "job:run",
    label: "job:run",
    description: "Lancer des jobs (inclut job:read et run:read)",
  },
  {
    id: "run:read",
    label: "run:read",
    description: "Consulter les exécutions et le flux de logs",
  },
  {
    id: "workflow:read",
    label: "workflow:read",
    description: "Lire les workflows",
  },
  {
    id: "workflow:run",
    label: "workflow:run",
    description: "Lancer des workflows (inclut workflow:read)",
  },
  {
    id: "admin",
    label: "admin",
    description: "Accès complet via clé API",
  },
] as const;

export const DEFAULT_API_KEY_SCOPES = ["job:run", "run:read"];

export const API_ROUTE_GROUPS: ApiRouteGroup[] = [
  {
    id: "auth",
    title: "Authentification",
    description: "Connexion utilisateur et contexte organisation",
    routes: [
      {
        method: "POST",
        path: "/api/v1/auth/login",
        summary: "Obtenir un JWT à partir d'email / mot de passe",
        auth: "public",
        body: '{ "email": "admin@example.com", "password": "…" }',
        response: '{ "access_token": "eyJ…", "token_type": "bearer" }',
      },
      {
        method: "GET",
        path: "/api/v1/auth/me",
        summary: "Profil de l'utilisateur connecté",
        permission: "org:read",
        auth: "user",
      },
      {
        method: "GET",
        path: "/api/v1/auth/organization",
        summary: "Organisation courante",
        permission: "org:read",
        auth: "user",
      },
    ],
  },
  {
    id: "jobs",
    title: "Jobs",
    description: "CRUD jobs, fichiers overlay, prévisualisation Git",
    routes: [
      { method: "GET", path: "/api/v1/jobs", summary: "Lister les jobs", permission: "job:read", auth: "api_key" },
      { method: "POST", path: "/api/v1/jobs", summary: "Créer un job", permission: "job:write", auth: "user" },
      { method: "POST", path: "/api/v1/jobs/git-preview", summary: "Prévisualiser un dépôt Git", permission: "job:write", auth: "user" },
      { method: "GET", path: "/api/v1/jobs/{job_id}", summary: "Détail d'un job", permission: "job:read", auth: "api_key" },
      { method: "PATCH", path: "/api/v1/jobs/{job_id}", summary: "Mettre à jour un job", permission: "job:write", auth: "user" },
      { method: "GET", path: "/api/v1/jobs/{job_id}/stats", summary: "Statistiques d'exécution", permission: "job:read", auth: "user" },
      { method: "GET", path: "/api/v1/jobs/{job_id}/runs", summary: "Historique des runs du job", permission: "run:read", auth: "user" },
      { method: "GET", path: "/api/v1/jobs/{job_id}/files", summary: "Arborescence des fichiers overlay", permission: "job:read", auth: "user" },
      { method: "GET", path: "/api/v1/jobs/{job_id}/files/{path}", summary: "Lire un fichier overlay", permission: "job:read", auth: "user" },
      { method: "PUT", path: "/api/v1/jobs/{job_id}/files/{path}", summary: "Écrire un fichier overlay", permission: "job:write", auth: "user" },
    ],
  },
  {
    id: "runs",
    title: "Exécutions",
    description: "Lancer des jobs, suivre les runs et les logs",
    routes: [
      {
        method: "POST",
        path: "/api/v1/jobs/{job_slug}/run",
        summary: "Lancer un job",
        permission: "job:run",
        auth: "api_key",
        query: "?wait=false&wait_timeout=120",
        body: '{ "arguments": { "cal_only": true } }',
        response: '202 { "run_id": "01KX…", "status": "queued" }',
      },
      { method: "GET", path: "/api/v1/runs", summary: "Lister les runs", permission: "run:read", auth: "api_key", query: "?status=running&job_id=…" },
      { method: "GET", path: "/api/v1/runs/{run_id}", summary: "Détail d'une exécution", permission: "run:read", auth: "api_key" },
      { method: "GET", path: "/api/v1/runs/{run_id}/logs/stream", summary: "Flux SSE des logs (temps réel)", permission: "run:read", auth: "api_key" },
    ],
  },
  {
    id: "workflows",
    title: "Workflows",
    description: "Orchestration DAG de jobs",
    routes: [
      { method: "GET", path: "/api/v1/workflows", summary: "Lister les workflows", permission: "workflow:read", auth: "user" },
      { method: "POST", path: "/api/v1/workflows", summary: "Créer un workflow", permission: "project:write", auth: "user" },
      { method: "POST", path: "/api/v1/workflows/{id}/run", summary: "Lancer un workflow", permission: "workflow:run", auth: "user" },
      { method: "GET", path: "/api/v1/workflows/{id}/runs", summary: "Runs d'un workflow", permission: "workflow:read", auth: "user" },
    ],
  },
  {
    id: "automation",
    title: "Automatisation",
    description: "Workers, triggers, webhooks et inventaires",
    routes: [
      { method: "GET", path: "/api/v1/workers", summary: "Lister les workers", permission: "worker:read", auth: "user" },
      { method: "POST", path: "/api/v1/workers", summary: "Créer un worker (token d'enregistrement)", permission: "worker:write", auth: "user" },
      { method: "GET", path: "/api/v1/triggers", summary: "Lister les triggers", permission: "job:read", auth: "user" },
      { method: "POST", path: "/api/v1/triggers", summary: "Créer un trigger (webhook / cron)", permission: "job:write", auth: "user" },
      { method: "POST", path: "/api/v1/hooks/{hook_token}", summary: "Déclencher un job via webhook", auth: "hook", body: '{ "arguments": {} }' },
      { method: "GET", path: "/api/v1/inventories", summary: "Lister les inventaires Ansible", permission: "project:read", auth: "user" },
    ],
  },
  {
    id: "secrets",
    title: "Secrets & credentials",
    description: "Données sensibles chiffrées",
    routes: [
      { method: "GET", path: "/api/v1/secrets", summary: "Lister les secrets (noms uniquement)", permission: "job:write", auth: "user" },
      { method: "POST", path: "/api/v1/secrets", summary: "Créer un secret", permission: "job:write", auth: "user" },
      { method: "GET", path: "/api/v1/credentials", summary: "Lister les credentials", permission: "job:read", auth: "user" },
      { method: "POST", path: "/api/v1/credentials", summary: "Créer un credential (Git PAT, SSH…)", permission: "job:write", auth: "user" },
    ],
  },
  {
    id: "api-keys",
    title: "Clés API",
    description: "Gestion des tokens d'accès programmatique",
    routes: [
      { method: "GET", path: "/api/v1/api-keys", summary: "Lister les clés API", permission: "apikey:read", auth: "user" },
      { method: "POST", path: "/api/v1/api-keys", summary: "Créer une clé API", permission: "apikey:write", auth: "user", body: '{ "name": "ci", "scopes": ["job:run", "run:read"] }' },
    ],
  },
  {
    id: "dashboard",
    title: "Tableau de bord",
    description: "Métriques agrégées",
    routes: [
      { method: "GET", path: "/api/v1/dashboard/stats", summary: "Statistiques globales", permission: "org:read", auth: "user" },
      { method: "GET", path: "/api/v1/dashboard/recent-runs", summary: "Dernières exécutions", permission: "run:read", auth: "user" },
    ],
  },
  {
    id: "worker",
    title: "Worker (agent)",
    description: "Endpoints réservés aux agents d'exécution",
    routes: [
      { method: "POST", path: "/api/v1/worker/register", summary: "Enregistrer un worker", auth: "public", body: '{ "registration_token": "rf_reg_…", "hostname": "…" }' },
      { method: "POST", path: "/api/v1/worker/heartbeat", summary: "Heartbeat worker", auth: "worker" },
      { method: "POST", path: "/api/v1/worker/claim", summary: "Réclamer un run en file", auth: "worker" },
      { method: "POST", path: "/api/v1/worker/runs/{run_id}/accept", summary: "Accepter un run", auth: "worker" },
      { method: "POST", path: "/api/v1/worker/runs/{run_id}/logs", summary: "Pousser des logs", auth: "worker" },
      { method: "POST", path: "/api/v1/worker/runs/{run_id}/result", summary: "Soumettre le résultat", auth: "worker" },
    ],
  },
  {
    id: "system",
    title: "Système",
    description: "Santé et métriques",
    routes: [
      { method: "GET", path: "/health", summary: "Healthcheck", auth: "public" },
      { method: "GET", path: "/ready", summary: "Readiness (DB, Valkey)", auth: "public" },
      { method: "GET", path: "/metrics", summary: "Métriques Prometheus", auth: "public" },
    ],
  },
];

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || window.location.origin.replace(/:\d+$/, ":8000");
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

export function buildCurlExample(
  route: ApiRouteDoc,
  token: string,
  baseUrl: string,
): string {
  const url = `${baseUrl}${route.path.replace("{job_slug}", "mon-job").replace("{run_id}", "01KX…").replace("{job_id}", "01JOB…").replace("{hook_token}", "hook_…").replace("{id}", "01WF…").replace("{path}", ".env")}${route.query || ""}`;
  const headers = ["-H \"Content-Type: application/json\""];
  if (route.auth === "api_key" || route.auth === "user") {
    headers.push(`-H "Authorization: Bearer ${token || "rf_live_…"}"`);
  }
  if (route.method === "GET" || route.method === "DELETE") {
    return `curl -s ${headers.join(" ")} \\\n  "${url}"`;
  }
  const body = route.body || "{}";
  return `curl -s -X ${route.method} ${headers.join(" ")} \\\n  -d '${body}' \\\n  "${url}"`;
}
