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

async function waitForRun(runId: string, timeoutMs = 120_000): Promise<Run> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const run = await request<Run>(`/api/v1/runs/${runId}`);
    if (["success", "failed", "timeout", "cancelled", "skipped"].includes(run.status)) {
      return run;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Délai d'attente dépassé");
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  getStats: () => request<DashboardStats>("/api/v1/dashboard/stats"),
  getRecentRuns: () => request<Run[]>("/api/v1/dashboard/recent-runs"),
  cancelRun: (runId: string) =>
    request<Run>(`/api/v1/runs/${runId}/cancel`, { method: "POST" }),
  rerunRun: (runId: string) =>
    request<{ run_id: string; status: string }>(`/api/v1/runs/${runId}/rerun`, { method: "POST" }),
  getJobs: () => request<Job[]>("/api/v1/jobs"),
  getJob: (id: string) => request<Job>(`/api/v1/jobs/${id}`),
  getJobStats: (id: string) => request<JobStats>(`/api/v1/jobs/${id}/stats`),
  getJobRuns: (id: string) => request<Run[]>(`/api/v1/jobs/${id}/runs`),
  createJob: (data: JobCreate) =>
    request<Job>("/api/v1/jobs", { method: "POST", body: JSON.stringify(data) }),
  previewGitJob: (data: GitPreviewRequest) =>
    request<GitPreviewResponse>("/api/v1/jobs/git-preview", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateJob: (id: string, data: JobUpdate) =>
    request<Job>(`/api/v1/jobs/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  testJobNotification: (id: string, channel: "email" | "pushover") =>
    request<NotificationTestResult>(`/api/v1/jobs/${id}/notifications/test`, {
      method: "POST",
      body: JSON.stringify({ channel }),
    }),
  getProjects: () => request<Project[]>("/api/v1/projects"),
  getRuns: (params?: { status?: string; job_id?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return request<Run[]>(`/api/v1/runs${q ? `?${q}` : ""}`);
  },
  getRun: (id: string) => request<Run>(`/api/v1/runs/${id}`),
  waitForRun,
  runJob: async (
    slug: string,
    arguments_: Record<string, unknown>,
    wait = false,
    debug = false,
  ) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/jobs/${slug}/run?wait=${wait}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify({ arguments: arguments_, debug }),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(", ")
        : typeof detail === "string"
          ? detail
          : res.statusText;
      throw new Error(message || res.statusText);
    }
    if (wait && res.status === 202 && data.run_id) {
      return waitForRun(data.run_id);
    }
    return data as Run | { run_id: string; status: string };
  },

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
  deleteJob: (id: string) =>
    request<void>(`/api/v1/jobs/${id}`, { method: "DELETE" }),

  getTriggers: () => request<Trigger[]>("/api/v1/triggers"),
  createTrigger: (data: TriggerCreate) =>
    request<Trigger>("/api/v1/triggers", { method: "POST", body: JSON.stringify(data) }),
  updateTrigger: (id: string, data: TriggerUpdate) =>
    request<Trigger>(`/api/v1/triggers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTrigger: (id: string) =>
    request<void>(`/api/v1/triggers/${id}`, { method: "DELETE" }),
  getMailboxes: () => request<Mailbox[]>("/api/v1/mailboxes"),
  createMailbox: (data: MailboxCreate) =>
    request<Mailbox>("/api/v1/mailboxes", { method: "POST", body: JSON.stringify(data) }),
  getSecrets: () => request<Secret[]>("/api/v1/secrets"),
  createSecret: (data: SecretCreate) =>
    request<Secret>("/api/v1/secrets", { method: "POST", body: JSON.stringify(data) }),
  getCredentials: () => request<Credential[]>("/api/v1/credentials"),
  createCredential: (data: CredentialCreate) =>
    request<Credential>("/api/v1/credentials", { method: "POST", body: JSON.stringify(data) }),
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

  getMe: () => request<User>("/api/v1/auth/me"),
  getOrganization: () => request<Organization>("/api/v1/auth/organization"),
  getInventories: () => request<Inventory[]>("/api/v1/inventories"),
  createInventory: (data: InventoryCreate) =>
    request<Inventory>("/api/v1/inventories", { method: "POST", body: JSON.stringify(data) }),
  getApiKeys: () => request<ApiKey[]>("/api/v1/api-keys"),
  createApiKey: (data: ApiKeyCreate) =>
    request<ApiKeyCreated>("/api/v1/api-keys", { method: "POST", body: JSON.stringify(data) }),
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
  description?: string;
  param_type: string;
  required: boolean;
  default_value?: unknown;
  options?: string[];
  validation?: Record<string, unknown>;
  position?: number;
  enabled?: boolean;
}

export interface GitConfig {
  repository_url: string;
  branch?: string;
  path?: string;
  username?: string;
  access_token?: string;
  credential_id?: string;
}

export interface GitPreviewRequest {
  git_config: GitConfig;
  runner_type?: string;
  entrypoint?: string;
  access_token?: string;
}

export interface GitPreviewFile {
  path: string;
  is_directory: boolean;
}

export interface GitPreviewResponse {
  files: GitPreviewFile[];
  env_example_path?: string | null;
  env_example_content?: string | null;
  suggested_entrypoints: string[];
  detected_parameters: JobParameterInput[];
  entrypoint?: string | null;
}

export interface JobNotificationEmailConfig {
  enabled: boolean;
  recipients: string[];
}

export interface JobNotificationPushoverConfig {
  enabled: boolean;
  user_key: string;
  app_token?: string | null;
}

export interface JobNotificationConfig {
  enabled: boolean;
  on_success: boolean;
  on_failure: boolean;
  email: JobNotificationEmailConfig;
  pushover: JobNotificationPushoverConfig;
  pushover_user_key_set?: boolean;
}

export interface NotificationTestResult {
  channel: string;
  success: boolean;
  message: string;
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
  git_config?: GitConfig | null;
  has_env_file?: boolean;
  timeout_seconds?: number;
  prevent_concurrent_runs?: boolean;
  notification_config?: JobNotificationConfig | null;
  forced_arguments?: Record<string, unknown>;
  parameters: JobParameter[];
  project_id: string;
}

export interface JobParameterInput {
  name: string;
  label?: string;
  description?: string;
  param_type?: string;
  required?: boolean;
  default_value?: unknown;
  options?: string[];
  position?: number;
  enabled?: boolean;
}

export interface JobCreate {
  project_id: string;
  name: string;
  slug: string;
  runner_type?: string;
  source_type?: string;
  entrypoint?: string;
  git_config?: GitConfig;
  env_file_content?: string;
  parameters?: JobParameterInput[];
}

export interface JobUpdate {
  name?: string;
  description?: string;
  entrypoint?: string;
  source_type?: string;
  runner_type?: string;
  git_config?: GitConfig;
  env_file_content?: string;
  timeout_seconds?: number;
  concurrency_limit?: number;
  prevent_concurrent_runs?: boolean;
  network_mode?: string;
  memory_limit_mb?: number;
  cpu_limit?: number;
  parameters?: JobParameterInput[];
  enabled?: boolean;
  notification_config?: JobNotificationConfig;
  forced_arguments?: Record<string, unknown>;
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

export interface Trigger {
  id: string;
  name: string;
  trigger_type: string;
  target_type: string;
  target_id?: string;
  hook_token?: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  project_id?: string | null;
}
export interface TriggerCreate {
  name: string;
  trigger_type: string;
  target_id: string;
  project_id?: string;
  config?: Record<string, unknown>;
}
export interface TriggerUpdate {
  name?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
  target_id?: string;
}
export interface Mailbox {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  polling_interval: number;
}
export interface MailboxCreate {
  name: string;
  provider?: string;
  config?: Record<string, unknown>;
  credential_id?: string;
  polling_interval?: number;
  mark_as_read?: boolean;
}
export interface Secret { id: string; name: string; scope: string }
export interface SecretCreate { name: string; value: string; scope?: string }
export interface Credential { id: string; name: string; credential_type: string }
export interface CredentialCreate { name: string; credential_type: string; data: Record<string, unknown>; project_id?: string }
export interface WorkerInfo { id: string; name: string; status: string; labels: Record<string, string>; current_runs: number; hostname?: string; version?: string; last_seen_at?: string }
export interface User { id: string; email: string; enabled: boolean }
export interface Organization { id: string; name: string; slug: string }
export interface Inventory { id: string; name: string; source_type: string }
export interface InventoryCreate { name: string; source_type?: string; content?: string; project_id?: string }
export interface ApiKey { id: string; name: string; prefix: string; scopes: string[]; enabled: boolean }
export interface ApiKeyCreate { name: string; scopes?: string[]; project_id?: string }
export interface ApiKeyCreated extends ApiKey { key: string }
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
  debug?: boolean;
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
  const controller = new AbortController();
  let finished = false;
  let lastSequence = 0;

  // If no data (not even a keep-alive ping) is received within this window, the
  // connection is considered dead (e.g. proxy dropped it silently) and we force
  // a reconnect. The server pings every ~15s, so 35s is a safe threshold.
  const STALE_TIMEOUT = 35000;

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  async function connectOnce(): Promise<void> {
    const token = getToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    // Resume where we left off so no log is missed after a reconnect.
    if (lastSequence > 0) headers["Last-Event-ID"] = String(lastSequence);

    // Per-connection controller so the inactivity watchdog can drop just this
    // socket (and trigger a reconnect) without cancelling the whole stream.
    const connController = new AbortController();
    const onOuterAbort = () => connController.abort();
    controller.signal.addEventListener("abort", onOuterAbort);

    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const armWatchdog = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => connController.abort(), STALE_TIMEOUT);
    };

    try {
      const res = await fetch(`${API_URL}/api/v1/runs/${runId}/logs/stream`, {
        headers,
        signal: connController.signal,
      });

      // Client errors (auth/not found) are not recoverable — stop retrying.
      if (res.status >= 400 && res.status < 500) {
        finished = true;
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream body");

      const decoder = new TextDecoder();
      let buffer = "";
      armWatchdog();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        armWatchdog();
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const lines = part.split("\n");
          let event = "message";
          let data = "";
          let eventId = "";
          for (const line of lines) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data = line.slice(5).trim();
            else if (line.startsWith("id:")) eventId = line.slice(3).trim();
            // lines starting with ":" are keep-alive comments — ignored
          }
          if (eventId && /^\d+$/.test(eventId)) {
            lastSequence = Math.max(lastSequence, parseInt(eventId, 10));
          }
          if (!data) continue;
          let parsed: { sequence?: number; stream?: string; message?: string; timestamp?: string; status?: string };
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }
          if (event === "log") {
            if (typeof parsed.sequence === "number") {
              lastSequence = Math.max(lastSequence, parsed.sequence);
            }
            onLog(parsed as { sequence: number; stream: string; message: string; timestamp: string });
          } else if (event === "status") {
            if (parsed.status) onStatus(parsed.status);
          } else if (event === "done") {
            finished = true;
            onDone();
            return;
          }
        }
      }
    } finally {
      if (watchdog) clearTimeout(watchdog);
      controller.signal.removeEventListener("abort", onOuterAbort);
    }
  }

  (async () => {
    while (!finished && !controller.signal.aborted) {
      try {
        await connectOnce();
      } catch {
        if (controller.signal.aborted) return;
        // network hiccup / proxy closed the connection — reconnect below
      }
      if (finished || controller.signal.aborted) return;
      await sleep(1500);
    }
  })();

  return () => {
    finished = true;
    controller.abort();
  };
}
