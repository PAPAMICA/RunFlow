"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [runs, setRuns] = useState<{ id: string; status: string }[]>([]);

  useEffect(() => { api.getWorkflowRuns(id).then(setRuns).catch(console.error); }, [id]);

  async function runWorkflow() {
    const result = await api.runWorkflow(id, {});
    alert(JSON.stringify(result));
    api.getWorkflowRuns(id).then(setRuns).catch(console.error);
  }

  return (
    <AppShell>
      <h2 className="text-xl font-bold mb-4">Workflow {id.slice(0, 8)}...</h2>
      <Button onClick={runWorkflow} className="mb-6">Lancer le workflow</Button>
      <h3 className="font-semibold mb-2">Runs</h3>
      <ul className="space-y-1 text-sm">
        {runs.map((r) => (
          <li key={r.id}>{r.id.slice(0, 12)}... — {r.status}</li>
        ))}
      </ul>
    </AppShell>
  );
}
