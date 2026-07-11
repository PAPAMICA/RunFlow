"use client";

import { useEffect, useState } from "react";
import { Plus, Shield, Zap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api, Job, Project, Trigger } from "@/lib/api";

export default function TriggersPage() {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("webhook");
  const [targetId, setTargetId] = useState("");
  const [cronExpr, setCronExpr] = useState("0 * * * *");
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  async function refresh() {
    const [t, j, p] = await Promise.all([api.getTriggers(), api.getJobs(), api.getProjects()]);
    setTriggers(t);
    setJobs(j);
    setProjects(p);
    if (!targetId && j[0]) setTargetId(j[0].id);
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const config = triggerType === "schedule" ? { cron: cronExpr } : {};
      await api.createTrigger({
        name,
        trigger_type: triggerType,
        target_id: targetId,
        project_id: projects[0]?.id,
        config,
      });
      setName("");
      setShowCreate(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Triggers"
        description="Webhooks, planifications cron et déclencheurs e-mail"
        action={
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4" />
            Nouveau trigger
          </Button>
        }
      />

      {showCreate && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="pt-5">
            <form onSubmit={handleCreate} className="grid gap-4 max-w-lg">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
                  <option value="webhook">Webhook</option>
                  <option value="schedule">Planification (cron)</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Job cible</Label>
                <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.name}</option>
                  ))}
                </Select>
              </div>
              {triggerType === "schedule" && (
                <div className="space-y-2">
                  <Label>Expression cron</Label>
                  <Input value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} className="font-mono" />
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit">Créer</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {triggers.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Aucun trigger"
          description="Automatisez l'exécution de vos jobs via webhooks ou cron."
          onAction={() => setShowCreate(true)}
          actionLabel="Créer un trigger"
        />
      ) : (
        <div className="space-y-3">
          {triggers.map((t) => (
            <Card key={t.id} hover>
              <CardContent className="pt-5 flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t.trigger_type} → {t.target_type}
                  </p>
                  {t.hook_token && (
                    <code className="text-xs text-primary/80 mt-2 block truncate">
                      /api/v1/hooks/{t.hook_token}
                    </code>
                  )}
                </div>
                <StatusBadge status={t.enabled ? "enabled" : "disabled"} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
