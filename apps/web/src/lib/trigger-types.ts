import {
  Clock,
  GitBranch,
  Globe,
  Link2,
  Mail,
  RefreshCw,
  Webhook,
  type LucideIcon,
} from "lucide-react";

export type TriggerTypeId =
  | "webhook"
  | "git_push"
  | "schedule"
  | "email"
  | "http_poll"
  | "run_event";

export interface TriggerTypeMeta {
  id: TriggerTypeId;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

export const TRIGGER_TYPES: TriggerTypeMeta[] = [
  {
    id: "webhook",
    label: "Webhook HTTP",
    description: "POST JSON depuis n'importe quel service externe",
    icon: Webhook,
    color: "text-primary",
  },
  {
    id: "git_push",
    label: "Git push",
    description: "GitHub, GitLab ou Bitbucket — déploiement à chaque push",
    icon: GitBranch,
    color: "text-accent",
  },
  {
    id: "schedule",
    label: "Planification",
    description: "Cron ou intervalles (horaire, quotidien, hebdomadaire…)",
    icon: Clock,
    color: "text-success",
  },
  {
    id: "email",
    label: "Email IMAP",
    description: "Déclencher à la réception d'un email correspondant",
    icon: Mail,
    color: "text-warning",
  },
  {
    id: "http_poll",
    label: "Polling HTTP",
    description: "Surveiller une URL et lancer le job si le contenu change",
    icon: RefreshCw,
    color: "text-primary",
  },
  {
    id: "run_event",
    label: "Fin de run",
    description: "Enchaîner un job après succès ou échec d'un autre",
    icon: Link2,
    color: "text-destructive",
  },
];

export const SCHEDULE_PRESETS = [
  { id: "every_5m", label: "Toutes les 5 min", cron: "*/5 * * * *" },
  { id: "every_15m", label: "Toutes les 15 min", cron: "*/15 * * * *" },
  { id: "hourly", label: "Toutes les heures", cron: "0 * * * *" },
  { id: "daily_2am", label: "Chaque jour à 2h", cron: "0 2 * * *" },
  { id: "weekly", label: "Chaque lundi 8h", cron: "0 8 * * 1" },
  { id: "custom", label: "Expression cron personnalisée", cron: "" },
];

export const GIT_PROVIDERS = [
  { id: "github", label: "GitHub" },
  { id: "gitlab", label: "GitLab" },
  { id: "bitbucket", label: "Bitbucket" },
  { id: "generic", label: "Générique" },
];

export const WEBHOOK_AUTH_TYPES = [
  { id: "none", label: "Aucune" },
  { id: "bearer", label: "Bearer token" },
  { id: "secret_header", label: "Header secret" },
  { id: "hmac_sha256", label: "HMAC SHA-256" },
];

export function buildTriggerConfig(
  type: TriggerTypeId,
  form: Record<string, string | boolean | string[]>
): Record<string, unknown> {
  switch (type) {
    case "webhook":
      return {
        auth_type: form.authType || "none",
        auth_config: buildAuthConfig(form),
        argument_mapping: parseJsonMapping(form.argumentMapping as string),
      };
    case "git_push":
      return {
        provider: form.gitProvider || "github",
        secret: form.gitSecret || "",
        branches: splitList(form.gitBranches as string),
        events: ["push"],
        argument_mapping: parseJsonMapping(form.argumentMapping as string),
      };
    case "schedule":
      return form.scheduleMode === "simple"
        ? {
            mode: "simple",
            interval: form.scheduleInterval || "daily",
            hour: Number(form.scheduleHour || 0),
            minutes: Number(form.scheduleMinutes || 5),
            timezone: form.timezone || "Europe/Paris",
            default_arguments: parseJsonMapping(form.defaultArguments as string),
          }
        : {
            mode: "advanced",
            cron: form.cronExpr || "0 * * * *",
            timezone: form.timezone || "Europe/Paris",
            default_arguments: parseJsonMapping(form.defaultArguments as string),
          };
    case "email":
      return {
        mailbox_id: form.mailboxId || "",
        conditions: {
          operator: "AND",
          conditions: [
            ...(form.emailFrom
              ? [{ field: "FROM", operator: "contains", value: form.emailFrom }]
              : []),
            ...(form.emailSubject
              ? [{ field: "SUBJECT", operator: "contains", value: form.emailSubject }]
              : []),
          ],
        },
        argument_mapping: parseJsonMapping(form.argumentMapping as string),
      };
    case "http_poll":
      return {
        url: form.pollUrl || "",
        method: form.pollMethod || "GET",
        interval_seconds: Number(form.pollInterval || 300),
        change_detection: form.pollDetection || "body_hash",
        json_path: form.pollJsonPath || "",
        fire_on_first: Boolean(form.pollFireOnFirst),
        default_arguments: parseJsonMapping(form.defaultArguments as string),
      };
    case "run_event":
      return {
        source_job_id: form.sourceJobId || "",
        on_status: splitList(form.runOnStatus as string) || ["success", "failed"],
        default_arguments: parseJsonMapping(form.defaultArguments as string),
        argument_mapping: {
          ...(parseJsonMapping(form.argumentMapping as string) as object),
          ...(form.passRunId
            ? { run_id: "{{ run.id }}", source_status: "{{ run.status }}" }
            : {}),
        },
      };
    default:
      return {};
  }
}

function buildAuthConfig(form: Record<string, string | boolean | string[]>) {
  const authType = form.authType || "none";
  if (authType === "bearer") return { token: form.authToken || "" };
  if (authType === "secret_header")
    return { header: form.authHeader || "X-Webhook-Secret", secret: form.authSecret || "" };
  if (authType === "hmac_sha256")
    return { header: form.authHeader || "X-Signature-256", secret: form.authSecret || "" };
  return {};
}

function splitList(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
}

function parseJsonMapping(raw: string | undefined): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function getHookUrl(hookToken: string, apiBase?: string): string {
  const base =
    apiBase ||
    (typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_API_URL || window.location.origin.replace(/:\d+$/, ":8000")
      : "http://localhost:8000");
  return `${base}/api/v1/hooks/${hookToken}`;
}
