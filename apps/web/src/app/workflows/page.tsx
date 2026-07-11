"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Workflow } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, Project, Workflow as WorkflowType } from "@/lib/api";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowType[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  async function refresh() {
    const [w, p] = await Promise.all([api.getWorkflows(), api.getProjects()]);
    setWorkflows(w);
    setProjects(p);
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  async function handleCreate() {
    if (!projects[0]) return;
    await api.createWorkflow({ project_id: projects[0].id, name, slug });
    setName("");
    setSlug("");
    setShowCreate(false);
    await refresh();
  }

  return (
    <AppShell>
      <PageHeader
        title="Workflows"
        description="Orchestrez vos jobs en graphes DAG"
        action={
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4" />
            Nouveau workflow
          </Button>
        }
      />

      {showCreate && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="pt-5 flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>
            <Button onClick={handleCreate} disabled={!name}>Créer</Button>
          </CardContent>
        </Card>
      )}

      {workflows.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="Aucun workflow"
          description="Enchaînez plusieurs jobs avec des dépendances et conditions."
          onAction={() => setShowCreate(true)}
          actionLabel="Créer un workflow"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((w) => (
            <Link key={w.id} href={`/workflows/${w.id}`}>
              <Card hover className="h-full">
                <CardContent className="pt-5">
                  <p className="font-semibold">{w.name}</p>
                  <p className="text-xs font-mono text-muted-foreground mt-1">{w.slug}</p>
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-sm text-muted-foreground">{w.node_count} nœud(s)</span>
                    <StatusBadge status={w.enabled ? "enabled" : "disabled"} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
