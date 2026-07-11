"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  GitBranch,
  Link2,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  Webhook,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { HookUrlCopy, TriggerForm } from "@/components/TriggerForm";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { TRIGGER_TYPES } from "@/lib/trigger-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, Job, Mailbox, Trigger } from "@/lib/api";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, typeof Zap> = {
  webhook: Webhook,
  git_push: GitBranch,
  schedule: Clock,
  email: Mail,
  http_poll: RefreshCw,
  run_event: Link2,
};

export default function TriggersPage() {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showMailbox, setShowMailbox] = useState(false);
  const [mailboxName, setMailboxName] = useState("");
  const [mailboxHost, setMailboxHost] = useState("");
  const [mailboxUser, setMailboxUser] = useState("");
  const [mailboxPassword, setMailboxPassword] = useState("");

  async function refresh() {
    const [t, j, m] = await Promise.all([
      api.getTriggers(),
      api.getJobs(),
      api.getMailboxes().catch(() => [] as Mailbox[]),
    ]);
    setTriggers(t);
    setJobs(j);
    setMailboxes(m);
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, []);

  async function toggleEnabled(trigger: Trigger) {
    await api.updateTrigger(trigger.id, { enabled: !trigger.enabled });
    await refresh();
  }

  async function deleteTrigger(id: string) {
    if (!confirm("Supprimer ce trigger ?")) return;
    await api.deleteTrigger(id);
    await refresh();
  }

  async function createMailbox() {
    await api.createMailbox({
      name: mailboxName,
      provider: "imap",
      config: { host: mailboxHost, port: 993, username: mailboxUser, password: mailboxPassword },
      polling_interval: 60,
    });
    setMailboxName("");
    setMailboxHost("");
    setMailboxUser("");
    setMailboxPassword("");
    setShowMailbox(false);
    await refresh();
  }

  const jobName = (id?: string) => jobs.find((j) => j.id === id)?.name ?? id?.slice(0, 8) ?? "—";

  return (
    <AppShell>
      <PageHeader
        title="Triggers"
        description="Déclenchez vos jobs via webhook, Git, cron, email, polling HTTP ou enchaînement de runs"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowMailbox(!showMailbox)}>
              <Mail className="h-4 w-4" />
              Mailbox IMAP
            </Button>
            <Button onClick={() => setShowCreate(!showCreate)}>
              <Plus className="h-4 w-4" />
              Nouveau trigger
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-8">
        {TRIGGER_TYPES.map((t) => {
          const Icon = t.icon;
          const count = triggers.filter((tr) => tr.trigger_type === t.id).length;
          return (
            <Card key={t.id} hover className={cn(count === 0 && "opacity-60")}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className={cn("rounded-lg p-1.5 bg-card-hover", t.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-2xl font-bold tabular-nums leading-none">{count}</p>
                </div>
                <span className="text-xs font-medium text-muted-foreground truncate block mt-2.5">
                  {t.label}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showMailbox && (
        <Card className="mb-6 border-accent/20">
          <CardContent className="pt-5 grid gap-3 max-w-lg">
            <p className="text-sm font-medium">Nouvelle boîte IMAP</p>
            <Input value={mailboxName} onChange={(e) => setMailboxName(e.target.value)} placeholder="Nom (ex. support)" />
            <Input value={mailboxHost} onChange={(e) => setMailboxHost(e.target.value)} placeholder="imap.example.com" />
            <Input value={mailboxUser} onChange={(e) => setMailboxUser(e.target.value)} placeholder="utilisateur" />
            <Input type="password" value={mailboxPassword} onChange={(e) => setMailboxPassword(e.target.value)} placeholder="mot de passe" />
            <Button onClick={createMailbox} disabled={!mailboxName || !mailboxHost}>Créer la mailbox</Button>
          </CardContent>
        </Card>
      )}

      {showCreate && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="pt-5">
            <TriggerForm
              jobs={jobs}
              mailboxes={mailboxes}
              onSubmit={async (data) => {
                await api.createTrigger(data);
                setShowCreate(false);
                await refresh();
              }}
              onCancel={() => setShowCreate(false)}
            />
          </CardContent>
        </Card>
      )}

      {triggers.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Aucun trigger"
          description="Automatisez vos jobs : webhook, push Git, cron, email, surveillance HTTP ou enchaînement après un run."
          onAction={() => setShowCreate(true)}
          actionLabel="Créer un trigger"
        />
      ) : (
        <div className="space-y-3">
          {triggers.map((t) => {
            const Icon = TYPE_ICONS[t.trigger_type] ?? Zap;
            const meta = TRIGGER_TYPES.find((x) => x.id === t.trigger_type);
            return (
              <Card key={t.id} hover>
                <CardContent className="pt-5 flex flex-wrap justify-between gap-4">
                  <div className="flex gap-3 min-w-0 flex-1">
                    <div className="rounded-lg bg-primary/10 p-2.5 shrink-0 h-fit">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{t.name}</p>
                        <Badge variant="muted" className="text-[10px]">{meta?.label ?? t.trigger_type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        → {jobName(t.target_id)}
                      </p>
                      {t.hook_token && <HookUrlCopy hookToken={t.hook_token} />}
                      {t.trigger_type === "schedule" && typeof t.config?.cron === "string" ? (
                        <code className="text-xs font-mono text-muted-foreground mt-1 block">
                          cron: {t.config.cron}
                        </code>
                      ) : null}
                      {t.trigger_type === "http_poll" && typeof t.config?.url === "string" ? (
                        <code className="text-xs font-mono text-muted-foreground mt-1 block truncate">
                          poll: {t.config.url}
                        </code>
                      ) : null}
                      {t.trigger_type === "run_event" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Après {jobName(String(t.config?.source_job_id ?? ""))} —{" "}
                          {Array.isArray(t.config?.on_status) ? (t.config.on_status as string[]).join(", ") : "success, failed"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={t.enabled ? "enabled" : "disabled"} />
                    <Button variant="outline" size="sm" onClick={() => toggleEnabled(t)}>
                      {t.enabled ? "Désactiver" : "Activer"}
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => deleteTrigger(t.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
