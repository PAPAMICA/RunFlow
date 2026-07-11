"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <AppShell>
      <h2 className="text-xl font-bold mb-6">Triggers</h2>

      <Card className="p-4 mb-6">
        <form onSubmit={handleCreate} className="grid gap-3 max-w-lg">
          <Input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
          <select
            className="bg-background border border-border rounded px-3 py-2"
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value)}
          >
            <option value="webhook">Webhook</option>
            <option value="schedule">Schedule (cron)</option>
          </select>
          <select
            className="bg-background border border-border rounded px-3 py-2"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.name}</option>
            ))}
          </select>
          {triggerType === "schedule" && (
            <Input placeholder="Expression cron" value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} />
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Button type="submit">Créer</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {triggers.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="flex justify-between">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-sm text-muted">{t.trigger_type} → {t.target_type}</p>
                {t.hook_token && <p className="text-xs text-muted mt-1">Hook: /api/v1/hooks/{t.hook_token}</p>}
              </div>
              <span className={t.enabled ? "text-green-400" : "text-muted"}>{t.enabled ? "enabled" : "disabled"}</span>
            </div>
          </Card>
        ))}
        {triggers.length === 0 && <p className="text-muted">Aucun trigger configuré</p>}
      </div>
    </AppShell>
  );
}
