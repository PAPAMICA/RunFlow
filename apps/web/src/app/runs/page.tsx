"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, Run } from "@/lib/api";

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getRuns(status ? { status } : undefined)
      .then(setRuns)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <AppShell>
      <PageHeader
        title="Exécutions"
        description="Historique et suivi de toutes les runs"
        action={
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-40"
          >
            <option value="">Tous</option>
            <option value="running">En cours</option>
            <option value="success">Succès</option>
            <option value="failed">Échec</option>
            <option value="queued">En file</option>
          </Select>
        }
      />

      <Card>
        <CardContent className="pt-5 overflow-x-auto">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              <Play className="h-8 w-8 mx-auto mb-3 opacity-40" />
              Aucune exécution
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-3 font-medium">ID</th>
                  <th className="pb-3 font-medium">Statut</th>
                  <th className="pb-3 font-medium">Trigger</th>
                  <th className="pb-3 font-medium">Durée</th>
                  <th className="pb-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-border-subtle hover:bg-card-hover/50 transition-colors">
                    <td className="py-3">
                      <Link href={`/runs/${r.id}`} className="font-mono text-primary hover:underline">
                        {r.id.slice(0, 10)}…
                      </Link>
                    </td>
                    <td className="py-3"><StatusBadge status={r.status} /></td>
                    <td className="py-3 text-muted-foreground">{r.trigger_type}</td>
                    <td className="py-3 text-muted-foreground">{r.duration_seconds?.toFixed(1) ?? "—"}s</td>
                    <td className="py-3 text-muted-foreground">{new Date(r.queued_at).toLocaleString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
