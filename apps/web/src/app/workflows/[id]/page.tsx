"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Play, Workflow } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, Workflow as WorkflowType, WorkflowRunInfo } from "@/lib/api";

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [workflow, setWorkflow] = useState<WorkflowType | null>(null);
  const [runs, setRuns] = useState<WorkflowRunInfo[]>([]);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function refresh() {
    const [workflows, workflowRuns] = await Promise.all([
      api.getWorkflows(),
      api.getWorkflowRuns(id),
    ]);
    setWorkflow(workflows.find((w) => w.id === id) ?? null);
    setRuns(workflowRuns);
  }

  useEffect(() => { refresh().catch(console.error); }, [id]);

  async function runWorkflow() {
    setRunning(true);
    setLastResult(null);
    try {
      const result = await api.runWorkflow(id, {});
      setLastResult(`Workflow lancé : ${result.workflow_run_id.slice(0, 12)}… (${result.status})`);
      await refresh();
    } catch (err) {
      setLastResult(err instanceof Error ? err.message : "Erreur");
    } finally {
      setRunning(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title={workflow?.name ?? `Workflow ${id.slice(0, 8)}…`}
        description={workflow ? `${workflow.node_count} nœud(s) · ${workflow.slug}` : "Chargement…"}
        action={
          <Button onClick={runWorkflow} disabled={running}>
            <Play className="h-4 w-4" />
            {running ? "Lancement…" : "Lancer"}
          </Button>
        }
      />

      {lastResult && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="pt-4 text-sm text-muted-foreground">{lastResult}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            <CardTitle>Exécutions du workflow</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Aucune exécution</p>
          ) : (
            <ul className="space-y-2">
              {runs.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-border-subtle px-4 py-3 hover:bg-card-hover/50 transition-colors"
                >
                  <span className="font-mono text-sm">{r.id.slice(0, 14)}…</span>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-6">
        L&apos;éditeur visuel DAG (React Flow) sera disponible dans une prochaine version.
      </p>
    </AppShell>
  );
}
