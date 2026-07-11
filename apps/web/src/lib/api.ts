const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("runflow_token");
}

export function setToken(token: string) {
  localStorage.setItem("runflow_token", token);
}

export function clearToken() {
  localStorage.removeItem("runflow_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    const message = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(", ")
      : typeof detail === "string"
        ? detail
        : res.statusText;
    throw new Error(message || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  getStats: () => request<DashboardStats>("/api/v1/dashboard/stats"),
  getRecentRuns: () => request<Run[]>("/api/v1/dashboard/recent-runs"),
  getJobs: () => request<Job[]>("/api/v1/jobs"),
  getJob: (id: string) => request<Job>(`/api/v1/jobs/${id}`),
  getJobStats: (id: string) => request<JobStats>(`/api/v1/jobs/${id}/stats`),
  getJobRuns: (id: string) => request<Run[]>(`/api/v1/jobs/${id}/runs`),
  createJob: (data: JobCreate) =>
    request<Job>("/api/v1/jobs", { method: "POST", body: JSON.stringify(data) }),
  getProjects: () => request<Project[]>("/api/v1/projects"),
  getRuns: (params?: { status?: string; job_id?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return request<Run[]>(`/api/v1/runs${q ? `?${q}` : ""}`);
  },
  getRun: (id: string) => request<Run>(`/api/v1/runs/${id}`),
  runJob: (slug: string, arguments_: Record<string, unknown>, wait = false) =>
    request<Run | { run_id: string; status: string }>(
      `/api/v1/jobs/${slug}/run?wait=${wait}`,
      { method: "POST", body: JSON.stringify({ arguments: arguments_ }) }
    ),

  listJobFiles: (jobId: string) => request<JobFileNode[]>(`/api/v1/jobs/${jobId}/files`),
  getJobFile: (jobId: string, path: string) =>
    request<JobFileNode>(`/api/v1/jobs/${jobId}/files/${path}`),
  writeJobFile: (jobId: string, path: string, content: string) =>
    request<JobFileNode>(`/api/v1/jobs/${jobId}/files/${path}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  createJobFile: (jobId: string, path: string, isDirectory = false, content = "") =>
    request<JobFileNode>(`/api/v1/jobs/${jobId}/files`, {
      method: "POST",
      body: JSON.stringify({ path, is_directory: isDirectory, content }),
    }),
  deleteJobFile: (jobId: string, path: string) =>
    request<void>(`/api/v1/jobs/${jobId}/files/${path}`, { method: "DELETE" }),

  getTriggers: () => request<Trigger[]>("/api/v1/triggers"),
  createTrigger: (data: TriggerCreate) =>
    request<Trigger>("/api/v1/triggers", { method: "POST", body: JSON.stringify(data) }),
  getSecrets: () => request<Secret[]>("/api/v1/secrets"),
  createSecret: (data: SecretCreate) =>
    request<Secret>("/api/v1/secrets", { method: "POST", body: JSON.stringify(data) }),
  getCredentials: () => request<Credential[]>("/api/v1/credentials"),
  getWorkers: () => request<WorkerInfo[]>("/api/v1/workers"),
  createWorker: (data: { name: string; labels?: Record<string, string> }) =>
    request<{ id: string; name: string; token: string }>("/api/v1/workers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getWorkflows: () => request<Workflow[]>("/api/v1/workflows"),
  createWorkflow: (data: WorkflowCreate) =>
    request<Workflow>("/api/v1/workflows", { method: "POST", body: JSON.stringify(data) }),
  getWorkflowRuns: (id: string) => request<WorkflowRunInfo[]>(`/api/v1/workflows/${id}/runs`),
  runWorkflow: (id: string, args: Record<string, unknown>) =>
    request<{ workflow_run_id: string; status: string }>(`/api/v1/workflows/${id}/run`, {
      method: "POST",
      body: JSON.stringify({ arguments: args }),
    }),
  getAIProviders: () => request<AIProvider[]>("/api/v1/ai/providers"),
  askAI: (providerId: string, prompt: string, jobId: string, selectedFile?: string) =>
    request<{ changes: { path: string; content: string }[] }>("/api/v1/ai/ask", {
      method: "POST",
      body: JSON.stringify({ provider_id: providerId, prompt, job_id: jobId, selected_file: selectedFile }),
    }),
  applyAIChanges: (jobId: string, changes: { path: string; content: string }[]) =>
    request<{ applied: number }>("/api/v1/ai/apply", {
      method: "POST",
      body: JSON.stringify({ job_id: jobId, changes }),
    }),
};

export interface DashboardStats {
  runs_today: number;
  success_rate: number;
  running_jobs: number;
  failed_jobs: number;
  online_workers: number;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
}

export interface JobParameter {
  id: string;
  name: string;
  label?: string;
  param_type: string;
  required: boolean;
  default_value?: unknown;
  options?: string[];
}

export interface Job {
  id: string;
  name: string;
  slug: string;
  description?: string;
  runner_type: string;
  source_type: string;
  entrypoint: string;
  enabled: boolean;
  parameters: JobParameter[];
  project_id: string;
}

export interface JobCreate {
  project_id: string;
  name: string;
  slug: string;
  runner_type?: string;
  entrypoint?: string;
  parameters?: Omit<JobParameter, "id">[];
}

export interface JobFileNode {
  path: string;
  is_directory: boolean;
  content?: string;
}

export interface JobStats {
  total_runs: number;
  success_rate: number;
  avg_duration_seconds: number | null;
  last_run: Run | null;
  last_failure: Run | null;
}

export interface Trigger { id: string; name: string; trigger_type: string; target_type: string; target_id?: string; hook_token?: string; enabled: boolean }
export interface TriggerCreate { name: string; trigger_type: string; target_id: string; project_id?: string; config?: Record<string, unknown> }
export interface Secret { id: string; name: string; scope: string }
export interface SecretCreate { name: string; value: string; scope?: string }
export interface Credential { id: string; name: string; credential_type: string }
export interface WorkerInfo { id: string; name: string; status: string; labels: Record<string, string>; current_runs: number }
export interface Workflow { id: string; name: string; slug: string; node_count: number; enabled: boolean }
export interface WorkflowCreate { project_id: string; name: string; slug: string; nodes?: { job_id: string; slug: string }[] }
export interface WorkflowRunInfo { id: string; status: string }
export interface AIProvider { id: string; name: string; provider_type: string; model: string; enabled: boolean }

export interface Run {
  id: string;
  job_id: string;
  worker_id?: string;
  trigger_type: string;
  status: string;
  arguments: Record<string, unknown>;
  exit_code?: number;
  result?: Record<string, unknown>;
  error?: string;
  duration?: number;
  duration_seconds?: number;
  created_at: string;
  queued_at: string;
  started_at?: string;
  finished_at?: string;
}

export function streamRunLogs(
  runId: string,
  onLog: (data: { sequence: number; stream: string; message: string; timestamp: string }) => void,
  onStatus: (status: string) => void,
  onDone: () => void
): () => void {
  const token = getToken();
  const controller = new AbortController();

  (async () => {
    const res = await fetch(`${API_URL}/api/v1/runs/${runId}/logs/stream`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        const lines = part.split("\n");
        let event = "message";
        let data = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) event = line.slice(7);
          if (line.startsWith("data: ")) data = line.slice(6);
        }
        if (!data) continue;
        const parsed = JSON.parse(data);
        if (event === "log") onLog(parsed);
        if (event === "status") onStatus(parsed.status);
        if (event === "done") onDone();
      }
    }
  })();

  return () => controller.abort();
}
