"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  GIT_PROVIDERS,
  SCHEDULE_PRESETS,
  TRIGGER_TYPES,
  TriggerTypeId,
  WEBHOOK_AUTH_TYPES,
  buildTriggerConfig,
  getHookUrl,
} from "@/lib/trigger-types";
import { Job, Mailbox, TriggerCreate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function TriggerForm({
  jobs,
  mailboxes,
  onSubmit,
  onCancel,
}: {
  jobs: Job[];
  mailboxes: Mailbox[];
  onSubmit: (data: TriggerCreate) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<TriggerTypeId>("webhook");
  const [targetId, setTargetId] = useState(jobs[0]?.id ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Webhook
  const [authType, setAuthType] = useState("none");
  const [authToken, setAuthToken] = useState("");
  const [authSecret, setAuthSecret] = useState("");
  const [authHeader, setAuthHeader] = useState("X-Webhook-Secret");

  // Git push
  const [gitProvider, setGitProvider] = useState("github");
  const [gitSecret, setGitSecret] = useState("");
  const [gitBranches, setGitBranches] = useState("main");

  // Schedule
  const [scheduleMode, setScheduleMode] = useState<"simple" | "advanced">("simple");
  const [schedulePreset, setSchedulePreset] = useState("hourly");
  const [cronExpr, setCronExpr] = useState("0 * * * *");
  const [timezone, setTimezone] = useState("Europe/Paris");
  const [scheduleInterval, setScheduleInterval] = useState("daily");
  const [scheduleHour, setScheduleHour] = useState("2");

  // Email
  const [mailboxId, setMailboxId] = useState(mailboxes[0]?.id ?? "");
  const [emailFrom, setEmailFrom] = useState("");
  const [emailSubject, setEmailSubject] = useState("");

  // HTTP poll
  const [pollUrl, setPollUrl] = useState("");
  const [pollInterval, setPollInterval] = useState("300");
  const [pollDetection, setPollDetection] = useState("body_hash");
  const [pollJsonPath, setPollJsonPath] = useState("");
  const [pollFireOnFirst, setPollFireOnFirst] = useState(false);

  // Run event
  const [sourceJobId, setSourceJobId] = useState(jobs[0]?.id ?? "");
  const [runOnStatus, setRunOnStatus] = useState("success,failed");
  const [passRunId, setPassRunId] = useState(true);

  // Shared
  const [argumentMapping, setArgumentMapping] = useState("");
  const [defaultArguments, setDefaultArguments] = useState("");

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

          <div className="space-y-2">
            <Label>Mapping arguments (JSON optionnel)</Label>
            <Textarea
              value={argumentMapping}
              onChange={(e) => setArgumentMapping(e.target.value)}
              placeholder={'{"branch": "{{ git.branch }}", "env": "{{ webhook.body.env }}"}'}
              className="font-mono text-xs min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground">
              Templates Jinja2 : webhook.body, git.branch, email.subject, run.status, poll.state…
            </p>
          </div>

          {(triggerType === "schedule" || triggerType === "http_poll") && (
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
          {loading ? "Création…" : "Créer le trigger"}
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
