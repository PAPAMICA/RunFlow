"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bug, CheckCircle2, Loader2, Pause, Play, RotateCw, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DataTable, DataTableSkeleton } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FilterPills } from "@/components/FilterPills";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, Job, Run } from "@/lib/api";
import { cn, formatDuration, relativeTime } from "@/lib/utils";

function formatTrigger(type: string) {
  const labels: Record<string, string> = {
    manual: "Manuel",
    api: "API",
    schedule: "Planifié",
    webhook: "Webhook",
    workflow: "Workflow",
  };
  return labels[type] ?? type;
}

const STATUS_FILTERS = [
  { value: "", label: "Tous" },
  { value: "running", label: "En cours" },
  { value: "queued", label: "En file" },
  { value: "success", label: "Succès" },
  { value: "failed", label: "Échec" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

const ACTIVE = new Set(["running", "queued", "assigned", "preparing", "pending"]);

export default function RunsPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<Run[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<StatusFilter>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    api.getJobs().then(setJobs).catch(console.error);
  }, []);

  const jobMap = useMemo(() => {
    const m = new Map<string, Job>();
    for (const j of jobs) m.set(j.id, j);
    return m;
  }, [jobs]);

  const load = useCallback((initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    api
      .getRuns()
      .then(setRuns)
      .catch(console.error)
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => load(true), [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => load(), 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, load]);

  const counts = useMemo(() => {
    return {
      total: runs.length,
      success: runs.filter((r) => r.status === "success").length,
      failed: runs.filter((r) => ["failed", "timeout"].includes(r.status)).length,
      active: runs.filter((r) => ACTIVE.has(r.status)).length,
    };
  }, [runs]);

  const filtered = useMemo(() => {
    if (!status) return runs;
    if (status === "running") return runs.filter((r) => ACTIVE.has(r.status));
    if (status === "queued") return runs.filter((r) => r.status === "queued");
    if (status === "failed") return runs.filter((r) => ["failed", "timeout"].includes(r.status));
    return runs.filter((r) => r.status === status);
  }, [runs, status]);

  const stats = [
    { label: "Total", value: counts.total, icon: Play, tone: "text-primary bg-primary/10" },
    { label: "Succès", value: counts.success, icon: CheckCircle2, tone: "text-success bg-success/10" },
    { label: "Échecs", value: counts.failed, icon: XCircle, tone: "text-destructive bg-destructive/10" },
    { label: "Actifs", value: counts.active, icon: Loader2, tone: "text-accent bg-accent/10" },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Exécutions"
        description="Historique et suivi de toutes les runs"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? "secondary" : "outline"}
              onClick={() => setAutoRefresh((a) => !a)}
              title="Rafraîchissement automatique toutes les 5s"
            >
              {autoRefresh ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
                  Auto
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" />
                  Auto
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => load()} disabled={refreshing}>
              <RotateCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              Rafraîchir
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-xl border border-border bg-card/70 px-4 py-3"
            >
              <div className={cn("rounded-lg p-2", s.tone)}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-bold tabular-nums leading-none">{loading ? "—" : s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-4">
        <FilterPills
          options={STATUS_FILTERS.map((o) => ({ value: o.value, label: o.label }))}
          value={status}
          onChange={setStatus}
        />
      </div>

      <Card>
        <CardContent className="pt-5">
          {loading ? (
            <DataTableSkeleton rows={8} cols={5} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Play}
              title="Aucune exécution"
              description={
                status
                  ? "Aucune run ne correspond à ce filtre."
                  : "Lancez un job pour voir apparaître les exécutions ici."
              }
            />
          ) : (
            <DataTable>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Statut</th>
                  <th>Trigger</th>
                  <th>Durée</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const job = jobMap.get(r.job_id);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/runs/${r.id}`)}
                      className="cursor-pointer"
                    >
                      <td>
                        <div className="max-w-[280px]">
                          <span className="flex items-center gap-1.5 truncate font-medium text-foreground">
                            {job?.name ?? "Job inconnu"}
                            {r.debug && (
                              <span title="Mode debug" className="text-accent shrink-0">
                                <Bug className="h-3 w-3" />
                              </span>
                            )}
                          </span>
                          <span className="block truncate font-mono text-[11px] text-muted-foreground">
                            {job?.slug ? `${job.slug} · ` : ""}
                            {r.id.slice(0, 10)}…
                          </span>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="text-muted-foreground text-xs">{formatTrigger(r.trigger_type)}</td>
                      <td className="text-muted-foreground tabular-nums text-xs">
                        {formatDuration(r.duration_seconds)}
                      </td>
                      <td className="text-muted-foreground text-xs" title={new Date(r.queued_at).toLocaleString("fr-FR")}>
                        {relativeTime(r.queued_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
