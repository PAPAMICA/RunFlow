"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import {
  GIT_PROVIDERS,
  SCHEDULE_PRESETS,
  TRIGGER_TYPES,
  TriggerTypeId,
  WEBHOOK_AUTH_TYPES,
  buildTriggerConfig,
  getHookUrl,
} from "@/lib/trigger-types";
import { Job, JobParameter, Mailbox, Trigger, TriggerCreate } from "@/lib/api";
import { getUserFacingParameters } from "@/lib/job-args";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MAPPING_TYPES = new Set<TriggerTypeId>(["webhook", "git_push", "email", "run_event"]);
const DEFAULT_ARG_TYPES = new Set<TriggerTypeId>(["schedule", "http_poll"]);

function readInit(t: Trigger) {
  const c = (t.config ?? {}) as Record<string, unknown>;
  const auth = (c.auth_config ?? {}) as Record<string, string>;
  const cond = ((c.conditions as { conditions?: { field: string; value: string }[] })?.conditions ??
    []) as { field: string; value: string }[];
  const findCond = (f: string) => cond.find((x) => x.field === f)?.value ?? "";

  let amObj = { ...((c.argument_mapping as Record<string, unknown>) ?? {}) };
  if (t.trigger_type === "run_event") {
    delete amObj.run_id;
    delete amObj.source_status;
  }
  const am = Object.keys(amObj).length ? JSON.stringify(amObj, null, 2) : "";
  const daObj = (c.default_arguments as Record<string, unknown>) ?? {};
  const da = Object.keys(daObj).length ? JSON.stringify(daObj, null, 2) : "";

  return {
    name: t.name,
    triggerType: t.trigger_type as TriggerTypeId,
    targetId: t.target_id ?? "",
    authType: (c.auth_type as string) ?? "none",
    authToken: auth.token ?? "",
    authSecret: auth.secret ?? "",
    authHeader: auth.header ?? "X-Webhook-Secret",
    gitProvider: (c.provider as string) ?? "github",
    gitSecret: (c.secret as string) ?? "",
    gitBranches: ((c.branches as string[]) ?? []).join(", "),
    scheduleMode: ((c.mode as string) === "advanced" ? "advanced" : "simple") as "simple" | "advanced",
    cronExpr: (c.cron as string) ?? "0 * * * *",
    timezone: (c.timezone as string) ?? "Europe/Paris",
    scheduleInterval: (c.interval as string) ?? "daily",
    scheduleHour: String(c.hour ?? 2),
    mailboxId: (c.mailbox_id as string) ?? "",
    emailFrom: findCond("FROM"),
    emailSubject: findCond("SUBJECT"),
    pollUrl: (c.url as string) ?? "",
    pollInterval: String(c.interval_seconds ?? 300),
    pollDetection: (c.change_detection as string) ?? "body_hash",
    pollJsonPath: (c.json_path as string) ?? "",
    pollFireOnFirst: Boolean(c.fire_on_first),
    sourceJobId: (c.source_job_id as string) ?? "",
    runOnStatus: ((c.on_status as string[]) ?? ["success", "failed"]).join(","),
    passRunId: Boolean((c.argument_mapping as Record<string, unknown>)?.run_id),
    argumentMapping: am,
    defaultArguments: da,
  };
}

function exampleValueFor(p: JobParameter): unknown {
  if (p.default_value != null && p.default_value !== "") return p.default_value;
  if (p.param_type === "flag" || p.param_type === "boolean") return true;
  if (p.param_type === "integer") return 0;
  if ((p.param_type === "select" || p.param_type === "multi_select") && p.options?.length) {
    return p.options[0];
  }
  return "valeur";
}

export function TriggerForm({
  jobs,
  mailboxes,
  trigger,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  jobs: Job[];
  mailboxes: Mailbox[];
  trigger?: Trigger;
  submitLabel?: string;
  onSubmit: (data: TriggerCreate) => Promise<void>;
  onCancel: () => void;
}) {
  const init = useMemo(() => (trigger ? readInit(trigger) : null), [trigger]);
  const isEdit = Boolean(trigger);

  const [name, setName] = useState(init?.name ?? "");
  const [triggerType, setTriggerType] = useState<TriggerTypeId>(init?.triggerType ?? "webhook");
  const [targetId, setTargetId] = useState(init?.targetId ?? jobs[0]?.id ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Webhook
  const [authType, setAuthType] = useState(init?.authType ?? "none");
  const [authToken, setAuthToken] = useState(init?.authToken ?? "");
  const [authSecret, setAuthSecret] = useState(init?.authSecret ?? "");
  const [authHeader, setAuthHeader] = useState(init?.authHeader ?? "X-Webhook-Secret");

  // Git push
  const [gitProvider, setGitProvider] = useState(init?.gitProvider ?? "github");
  const [gitSecret, setGitSecret] = useState(init?.gitSecret ?? "");
  const [gitBranches, setGitBranches] = useState(init?.gitBranches ?? "main");

  // Schedule
  const [scheduleMode, setScheduleMode] = useState<"simple" | "advanced">(init?.scheduleMode ?? "simple");
  const [schedulePreset, setSchedulePreset] = useState(init ? "custom" : "hourly");
  const [cronExpr, setCronExpr] = useState(init?.cronExpr ?? "0 * * * *");
  const [timezone, setTimezone] = useState(init?.timezone ?? "Europe/Paris");
  const [scheduleInterval, setScheduleInterval] = useState(init?.scheduleInterval ?? "daily");
  const [scheduleHour, setScheduleHour] = useState(init?.scheduleHour ?? "2");

  // Email
  const [mailboxId, setMailboxId] = useState(init?.mailboxId ?? mailboxes[0]?.id ?? "");
  const [emailFrom, setEmailFrom] = useState(init?.emailFrom ?? "");
  const [emailSubject, setEmailSubject] = useState(init?.emailSubject ?? "");

  // HTTP poll
  const [pollUrl, setPollUrl] = useState(init?.pollUrl ?? "");
  const [pollInterval, setPollInterval] = useState(init?.pollInterval ?? "300");
  const [pollDetection, setPollDetection] = useState(init?.pollDetection ?? "body_hash");
  const [pollJsonPath, setPollJsonPath] = useState(init?.pollJsonPath ?? "");
  const [pollFireOnFirst, setPollFireOnFirst] = useState(init?.pollFireOnFirst ?? false);

  // Run event
  const [sourceJobId, setSourceJobId] = useState(init?.sourceJobId ?? jobs[0]?.id ?? "");
  const [runOnStatus, setRunOnStatus] = useState(init?.runOnStatus ?? "success,failed");
  const [passRunId, setPassRunId] = useState(init?.passRunId ?? true);

  // Shared
  const [argumentMapping, setArgumentMapping] = useState(init?.argumentMapping ?? "");
  const [defaultArguments, setDefaultArguments] = useState(init?.defaultArguments ?? "");

  const targetJob = jobs.find((j) => j.id === targetId);
  const jobParams = useMemo(
    () => (targetJob ? getUserFacingParameters(targetJob) : []),
    [targetJob]
  );

  const sourceExpr = useMemo(() => {
    return (name_: string) => {
      if (triggerType === "webhook" || triggerType === "git_push")
        return `{{ webhook.body.${name_} }}`;
      if (triggerType === "run_event") return `{{ run.arguments.${name_} }}`;
      if (triggerType === "email") return `{{ email.body }}`;
      return "";
    };
  }, [triggerType]);

  function applyParamMapping() {
    if (MAPPING_TYPES.has(triggerType)) {
      const m: Record<string, unknown> = {};
      jobParams.forEach((p) => (m[p.name] = sourceExpr(p.name)));
      setArgumentMapping(Object.keys(m).length ? JSON.stringify(m, null, 2) : "");
    }
    if (DEFAULT_ARG_TYPES.has(triggerType)) {
      const m: Record<string, unknown> = {};
      jobParams.forEach((p) => (m[p.name] = exampleValueFor(p)));
      setDefaultArguments(Object.keys(m).length ? JSON.stringify(m, null, 2) : "");
    }
  }

  // Auto-configure the job parameters when a job is selected and the relevant
  // field is still empty (never overwrites what the user already set).
  useEffect(() => {
    if (jobParams.length === 0) return;
    if (MAPPING_TYPES.has(triggerType) && !argumentMapping.trim()) {
      const m: Record<string, unknown> = {};
      jobParams.forEach((p) => (m[p.name] = sourceExpr(p.name)));
      setArgumentMapping(JSON.stringify(m, null, 2));
    }
    if (DEFAULT_ARG_TYPES.has(triggerType) && !defaultArguments.trim()) {
      const m: Record<string, unknown> = {};
      jobParams.forEach((p) => (m[p.name] = exampleValueFor(p)));
      setDefaultArguments(JSON.stringify(m, null, 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, triggerType, jobParams.length]);

  const exampleBlock = useMemo(() => {
    if (jobParams.length === 0) return "";
    if (triggerType === "webhook" || triggerType === "git_push") {
      const body: Record<string, unknown> = {};
      jobParams.forEach((p) => (body[p.name] = exampleValueFor(p)));
      return JSON.stringify(body, null, 2);
    }
    if (triggerType === "email" || triggerType === "run_event") {
      const m: Record<string, unknown> = {};
      jobParams.forEach((p) => (m[p.name] = sourceExpr(p.name)));
      return JSON.stringify(m, null, 2);
    }
    const m: Record<string, unknown> = {};
    jobParams.forEach((p) => (m[p.name] = exampleValueFor(p)));
    return JSON.stringify(m, null, 2);
  }, [jobParams, triggerType, sourceExpr]);

  const exampleLabel =
    triggerType === "webhook" || triggerType === "git_push"
      ? "Exemple de payload JSON attendu"
      : triggerType === "email" || triggerType === "run_event"
        ? "Mapping des arguments généré"
        : "Arguments par défaut générés";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const config = buildTriggerConfig(triggerType, {
        authType,
        authToken,
        authSecret,
        authHeader,
        gitProvider,
        gitSecret,
        gitBranches,
        scheduleMode,
        scheduleInterval,
        scheduleHour,
        scheduleMinutes: "5",
        cronExpr:
          schedulePreset === "custom"
            ? cronExpr
            : SCHEDULE_PRESETS.find((p) => p.id === schedulePreset)?.cron || cronExpr,
        timezone,
        mailboxId,
        emailFrom,
        emailSubject,
        pollUrl,
        pollMethod: "GET",
        pollInterval,
        pollDetection,
        pollJsonPath,
        pollFireOnFirst,
        sourceJobId,
        runOnStatus,
        passRunId,
        argumentMapping,
        defaultArguments,
      });

      await onSubmit({
        name,
        trigger_type: triggerType,
        target_id: targetId,
        config,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  const selectedMeta = TRIGGER_TYPES.find((t) => t.id === triggerType);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label>Nom du trigger</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="deploy-main" required />
      </div>

      <div className="space-y-2">
        <Label>Type de déclencheur</Label>
        {isEdit ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card/40 p-3">
            {selectedMeta && <selectedMeta.icon className={cn("h-4 w-4", selectedMeta.color)} />}
            <span className="text-sm font-medium">{selectedMeta?.label ?? triggerType}</span>
            <Badge variant="muted" className="text-[10px] ml-auto">
              Type non modifiable
            </Badge>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {TRIGGER_TYPES.map((t) => {
              const Icon = t.icon;
              const active = triggerType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTriggerType(t.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-all",
                    active ? "border-primary/50 bg-primary/10" : "border-border hover:bg-card-hover"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={cn("h-4 w-4", t.color)} />
                    <span className="text-sm font-medium">{t.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Job cible</Label>
        <Select value={targetId} onChange={(e) => setTargetId(e.target.value)} required>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name} ({j.slug})
            </option>
          ))}
        </Select>
      </div>

      {targetJob && jobParams.length > 0 && (
        <div className="rounded-xl border border-accent/25 bg-accent/5 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Paramètres du job « {targetJob.name} »</p>
            <Button type="button" variant="outline" size="sm" onClick={applyParamMapping}>
              <Sparkles className="h-3.5 w-3.5" />
              Configurer automatiquement
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {jobParams.map((p) => (
              <Badge key={p.id} variant="muted" className="font-mono text-[10px]">
                {p.name}
                {p.required && <span className="text-destructive">*</span>} · {p.param_type}
              </Badge>
            ))}
          </div>
          {exampleBlock && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">{exampleLabel}</p>
              <pre className="text-[11px] font-mono bg-black/40 rounded-lg p-3 overflow-x-auto">
                {exampleBlock}
              </pre>
            </div>
          )}
        </div>
      )}

      {selectedMeta && (
        <div className="rounded-xl border border-border bg-card/40 p-4 space-y-4">
          <p className="text-sm font-medium">{selectedMeta.label} — configuration</p>

          {triggerType === "webhook" && (
            <>
              <div className="space-y-2">
                <Label>Authentification</Label>
                <Select value={authType} onChange={(e) => setAuthType(e.target.value)}>
                  {WEBHOOK_AUTH_TYPES.map((a) => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </Select>
              </div>
              {authType === "bearer" && (
                <Input value={authToken} onChange={(e) => setAuthToken(e.target.value)} placeholder="Bearer token" />
              )}
              {(authType === "secret_header" || authType === "hmac_sha256") && (
                <>
                  <Input value={authHeader} onChange={(e) => setAuthHeader(e.target.value)} placeholder="Nom du header" />
                  <Input value={authSecret} onChange={(e) => setAuthSecret(e.target.value)} placeholder="Secret" />
                </>
              )}
            </>
          )}

          {triggerType === "git_push" && (
            <>
              <div className="space-y-2">
                <Label>Fournisseur Git</Label>
                <Select value={gitProvider} onChange={(e) => setGitProvider(e.target.value)}>
                  {GIT_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </Select>
              </div>
              <Input value={gitSecret} onChange={(e) => setGitSecret(e.target.value)} placeholder="Secret webhook (GitHub/GitLab)" />
              <Input value={gitBranches} onChange={(e) => setGitBranches(e.target.value)} placeholder="Branches (main, develop)" />
              <p className="text-xs text-muted-foreground">
                URL webhook générée après création — à coller dans les paramètres du dépôt.
              </p>
            </>
          )}

          {triggerType === "schedule" && (
            <>
              <div className="flex gap-2">
                <Button type="button" variant={scheduleMode === "simple" ? "default" : "outline"} size="sm" onClick={() => setScheduleMode("simple")}>
                  Simple
                </Button>
                <Button type="button" variant={scheduleMode === "advanced" ? "default" : "outline"} size="sm" onClick={() => setScheduleMode("advanced")}>
                  Cron avancé
                </Button>
              </div>
              {scheduleMode === "simple" ? (
                <>
                  <Select value={scheduleInterval} onChange={(e) => setScheduleInterval(e.target.value)}>
                    <option value="every_minutes">Toutes les N minutes</option>
                    <option value="hourly">Toutes les heures</option>
                    <option value="daily">Quotidien</option>
                    <option value="weekly">Hebdomadaire</option>
                  </Select>
                  {(scheduleInterval === "daily" || scheduleInterval === "weekly") && (
                    <Input type="number" min={0} max={23} value={scheduleHour} onChange={(e) => setScheduleHour(e.target.value)} placeholder="Heure (0-23)" />
                  )}
                </>
              ) : (
                <>
                  <Select value={schedulePreset} onChange={(e) => setSchedulePreset(e.target.value)}>
                    {SCHEDULE_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </Select>
                  <Input value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} className="font-mono text-xs" placeholder="0 * * * *" />
                </>
              )}
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Europe/Paris" />
            </>
          )}

          {triggerType === "email" && (
            <>
              <div className="space-y-2">
                <Label>Boîte IMAP</Label>
                <Select value={mailboxId} onChange={(e) => setMailboxId(e.target.value)}>
                  {mailboxes.length === 0 && <option value="">Aucune mailbox — créez-en une ci-dessous</option>}
                  {mailboxes.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
              </div>
              <Input value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} placeholder="Expéditeur contient…" />
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Sujet contient…" />
            </>
          )}

          {triggerType === "http_poll" && (
            <>
              <Input value={pollUrl} onChange={(e) => setPollUrl(e.target.value)} placeholder="https://api.example.com/status" required />
              <Input type="number" value={pollInterval} onChange={(e) => setPollInterval(e.target.value)} placeholder="Intervalle (secondes)" />
              <Select value={pollDetection} onChange={(e) => setPollDetection(e.target.value)}>
                <option value="body_hash">Changement du corps (hash)</option>
                <option value="json_path">Changement d&apos;un champ JSON</option>
              </Select>
              {pollDetection === "json_path" && (
                <Input value={pollJsonPath} onChange={(e) => setPollJsonPath(e.target.value)} placeholder="status.version" className="font-mono text-xs" />
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={pollFireOnFirst} onChange={(e) => setPollFireOnFirst(e.target.checked)} className="accent-primary" />
                Lancer au premier poll (sans attendre un changement)
              </label>
            </>
          )}

          {triggerType === "run_event" && (
            <>
              <div className="space-y-2">
                <Label>Job source (à surveiller)</Label>
                <Select value={sourceJobId} onChange={(e) => setSourceJobId(e.target.value)}>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.name}</option>
                  ))}
                </Select>
              </div>
              <Input value={runOnStatus} onChange={(e) => setRunOnStatus(e.target.value)} placeholder="success,failed,timeout" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={passRunId} onChange={(e) => setPassRunId(e.target.checked)} className="accent-primary" />
                Passer run_id et statut source en arguments
              </label>
            </>
          )}

          {MAPPING_TYPES.has(triggerType) && (
            <div className="space-y-2">
              <Label>Mapping arguments (JSON optionnel)</Label>
              <Textarea
                value={argumentMapping}
                onChange={(e) => setArgumentMapping(e.target.value)}
                placeholder={'{"branch": "{{ git.branch }}", "env": "{{ webhook.body.env }}"}'}
                className="font-mono text-xs min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground">
                Templates Jinja2 : webhook.body, git.branch, email.subject, run.arguments, poll.state…
              </p>
            </div>
          )}

          {DEFAULT_ARG_TYPES.has(triggerType) && (
            <div className="space-y-2">
              <Label>Arguments par défaut (JSON)</Label>
              <Textarea
                value={defaultArguments}
                onChange={(e) => setDefaultArguments(e.target.value)}
                placeholder='{"cal_only": true}'
                className="font-mono text-xs min-h-[60px]"
              />
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading || !name.trim() || !targetId}>
          {loading ? "Enregistrement…" : submitLabel ?? (isEdit ? "Enregistrer" : "Créer le trigger")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

export function HookUrlCopy({ hookToken }: { hookToken: string }) {
  const [copied, setCopied] = useState(false);
  const url = getHookUrl(hookToken);

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex gap-2 items-center mt-2">
      <code className="flex-1 text-xs font-mono bg-black/30 rounded-lg px-3 py-2 truncate">{url}</code>
      <Button variant="outline" size="icon" onClick={copy} type="button">
        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}
