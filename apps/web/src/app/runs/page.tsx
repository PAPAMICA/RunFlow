"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DataTable, DataTableSkeleton } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FilterPills } from "@/components/FilterPills";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { api, Run } from "@/lib/api";

const STATUS_FILTERS = [
  { value: "", label: "Tous" },
  { value: "running", label: "En cours" },
  { value: "queued", label: "En file" },
  { value: "success", label: "Succès" },
  { value: "failed", label: "Échec" },
] as const;

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]["value"]>("");
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
          <FilterPills
            options={STATUS_FILTERS.map((o) => ({ value: o.value, label: o.label }))}
            value={status}
            onChange={setStatus}
          />
        }
      />

      <Card>
        <CardContent className="pt-5">
          {loading ? (
            <DataTableSkeleton rows={8} />
          ) : runs.length === 0 ? (
            <EmptyState
              icon={Play}
              title="Aucune exécution"
              description={
                status
                  ? `Aucune run avec le statut « ${status} ».`
                  : "Lancez un job pour voir apparaître les exécutions ici."
              }
            />
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Statut</th>
                  <th>Trigger</th>
                  <th>Durée</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/runs/${r.id}`} className="link-mono text-xs">
                        {r.id.slice(0, 10)}…
                      </Link>
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="text-muted-foreground capitalize text-xs">{r.trigger_type}</td>
                    <td className="text-muted-foreground tabular-nums">
                      {r.duration_seconds?.toFixed(1) ?? "—"}s
                    </td>
                    <td className="text-muted-foreground text-xs">
                      {new Date(r.queued_at).toLocaleString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
