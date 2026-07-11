"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Mail,
  Send,
  Smartphone,
  XCircle,
} from "lucide-react";
import { api, Job, JobNotificationConfig } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const DEFAULT_CONFIG: JobNotificationConfig = {
  enabled: false,
  on_success: true,
  on_failure: true,
  email: { enabled: false, recipients: [] },
  pushover: { enabled: false, user_key: "" },
  pushover_user_key_set: false,
  pushover_app_token_set: false,
};

export function JobNotificationsForm({
  jobId,
  job,
  onSaved,
}: {
  jobId: string;
  job: Job;
  onSaved: (job: Job) => void;
}) {
  const [config, setConfig] = useState<JobNotificationConfig>(
    job.notification_config ?? DEFAULT_CONFIG
  );
  const [recipientsText, setRecipientsText] = useState("");
  const [pushoverKey, setPushoverKey] = useState("");
  const [pushoverToken, setPushoverToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [testing, setTesting] = useState<"email" | "pushover" | null>(null);
  const [testMsg, setTestMsg] = useState("");

  useEffect(() => {
    const nc = job.notification_config ?? DEFAULT_CONFIG;
    setConfig(nc);
    setRecipientsText((nc.email.recipients ?? []).join("\n"));
    setPushoverKey("");
    setPushoverToken("");
  }, [job]);

  function updateConfig(patch: Partial<JobNotificationConfig>) {
    setConfig((prev) => ({ ...prev, ...patch }));
  }

  async function save() {
    setSaving(true);
    setSaveMsg("");
    try {
      const recipients = recipientsText
        .split(/[\n,;]+/)
        .map((r) => r.trim())
        .filter(Boolean);
      const payload: JobNotificationConfig = {
        ...config,
        email: { ...config.email, recipients },
        pushover: {
          ...config.pushover,
          user_key: pushoverKey || config.pushover.user_key,
          app_token: pushoverToken || config.pushover.app_token,
        },
      };
      const updated = await api.updateJob(jobId, { notification_config: payload });
      onSaved(updated);
      setPushoverKey("");
      setPushoverToken("");
      setSaveMsg("Notifications enregistrées");
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function testChannel(channel: "email" | "pushover") {
    setTesting(channel);
    setTestMsg("");
    try {
      await save();
      const res = await api.testJobNotification(jobId, channel);
      setTestMsg(res.message);
    } catch (err) {
      setTestMsg(err instanceof Error ? err.message : "Erreur");
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="border-border/80">
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Notifications de fin d&apos;exécution</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Alertes par email ou Pushover à la fin de chaque run
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => updateConfig({ enabled: e.target.checked })}
                className="accent-primary h-4 w-4"
              />
              <span className="text-sm font-medium">Activé</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => updateConfig({ on_success: !config.on_success })}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all",
                config.on_success
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-border text-muted-foreground hover:bg-card-hover"
              )}
            >
              <CheckCircle2 className="h-4 w-4" />
              Succès
            </button>
            <button
              type="button"
              onClick={() => updateConfig({ on_failure: !config.on_failure })}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all",
                config.on_failure
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border text-muted-foreground hover:bg-card-hover"
              )}
            >
              <XCircle className="h-4 w-4" />
              Échec
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2">
                <Mail className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="font-medium">Email</p>
                <p className="text-xs text-muted-foreground">HTML avec lien vers le run</p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.email.enabled}
                onChange={(e) =>
                  updateConfig({ email: { ...config.email, enabled: e.target.checked } })
                }
                className="accent-primary h-4 w-4"
              />
              <span className="text-sm">Actif</span>
            </label>
          </div>
          <div className="space-y-2">
            <Label>Destinataires (un par ligne)</Label>
            <textarea
              value={recipientsText}
              onChange={(e) => setRecipientsText(e.target.value)}
              placeholder={"admin@example.com\nops@example.com"}
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono resize-y"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={testing === "email"}
            onClick={() => testChannel("email")}
          >
            <Send className="h-3.5 w-3.5" />
            {testing === "email" ? "Envoi…" : "Tester l'email"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-warning/10 p-2">
                <Smartphone className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="font-medium">Pushover</p>
                <p className="text-xs text-muted-foreground">
                  Token de l&apos;application + clé utilisateur
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.pushover.enabled}
                onChange={(e) =>
                  updateConfig({ pushover: { ...config.pushover, enabled: e.target.checked } })
                }
                className="accent-primary h-4 w-4"
              />
              <span className="text-sm">Actif</span>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Token de l&apos;application (API Token)</Label>
              <Input
                value={pushoverToken}
                onChange={(e) => setPushoverToken(e.target.value)}
                placeholder={
                  config.pushover_app_token_set
                    ? `${config.pushover.app_token ?? "••••"} (laisser vide pour conserver)`
                    : "azG…"
                }
                className="font-mono text-xs"
              />
              {config.pushover_app_token_set && !pushoverToken && (
                <Badge variant="muted" className="text-[10px]">Token enregistré</Badge>
              )}
            </div>
            <div className="space-y-2">
              <Label>Clé utilisateur (User Key)</Label>
              <Input
                value={pushoverKey}
                onChange={(e) => setPushoverKey(e.target.value)}
                placeholder={
                  config.pushover_user_key_set
                    ? `${config.pushover.user_key} (laisser vide pour conserver)`
                    : "uQi…"
                }
                className="font-mono text-xs"
              />
              {config.pushover_user_key_set && !pushoverKey && (
                <Badge variant="muted" className="text-[10px]">Clé enregistrée</Badge>
              )}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Créez une application sur pushover.net pour obtenir le token. Si aucun token n&apos;est
            renseigné, le token global du serveur (PUSHOVER_APP_TOKEN) est utilisé.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={testing === "pushover"}
            onClick={() => testChannel("pushover")}
          >
            <Send className="h-3.5 w-3.5" />
            {testing === "pushover" ? "Envoi…" : "Tester Pushover"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
        {saveMsg && (
          <p className={cn("text-sm", saveMsg.includes("Erreur") ? "text-destructive" : "text-success")}>
            {saveMsg}
          </p>
        )}
      </div>
      {testMsg && (
        <p className="text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4 py-3">
          {testMsg}
        </p>
      )}
    </div>
  );
}
