"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, Job, Project } from "@/lib/api";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<{ id: string; name: string; slug: string; node_count: number; enabled: boolean }[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [jobId, setJobId] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const [w, p, j] = await Promise.all([api.getWorkflows(), api.getProjects(), api.getJobs()]);
    setWorkflows(w);
    setProjects(p);
    setJobs(j);
    if (!jobId && j[0]) setJobId(j[0].id);
    if (!slug && name) setSlug(name.toLowerCase().replace(/\s+/g, "-"));
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!projects[0]) {
      setError("Aucun projet disponible");
      return;
    }
    try {
      await api.createWorkflow({
        project_id: projects[0].id,
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, "-"),
        nodes: jobId ? [{ job_id: jobId, slug: "step-1" }] : [],
      });
      setName("");
      setSlug("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <AppShell>
      <h2 className="text-xl font-bold mb-6">Workflows</h2>

      <Card className="p-4 mb-6">
        <form onSubmit={handleCreate} className="grid gap-3 max-w-lg">
          <Input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input placeholder="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <select
            className="bg-background border border-border rounded px-3 py-2"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.name}</option>
            ))}
          </select>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Button type="submit">Créer</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {workflows.map((w) => (
          <Card key={w.id} className="p-4">
            <Link href={`/workflows/${w.id}`} className="font-medium text-primary hover:underline">{w.name}</Link>
            <p className="text-sm text-muted">{w.slug} · {w.node_count} nodes</p>
          </Card>
        ))}
        {workflows.length === 0 && <p className="text-muted">Aucun workflow</p>}
      </div>
    </AppShell>
  );
}
