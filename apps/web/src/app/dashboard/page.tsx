"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Play,
  Server,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DataTable, DataTableSkeleton } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Sparkline } from "@/components/ui/sparkline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, DashboardStats, Job, Run } from "@/lib/api";
import { formatDuration, relativeTime } from "@/lib/utils";

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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getStats(), api.getRecentRuns(), api.getJobs()])
      .then(([s, r, j]) => {
        setStats(s);
        setRuns(r);
        setJobs(j);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const jobMap = useMemo(() => {
    const m = new Map<string, Job>();
    for (const j of jobs) m.set(j.id, j);
    return m;
  }, [jobs]);

  const durationSeries = useMemo(
    () =>
      runs
        .slice(0, 20)
        .map((r) => r.duration_seconds ?? 0)
        .reverse(),
    [runs]
  );

  return (
    <AppShell>
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de votre plateforme d'automatisation"
        action={
          <div className="flex gap-2">
            <Link href="/jobs">
              <Button variant="outline" type="button">
                <Boxes className="h-4 w-4" />
                Jobs
              </Button>
            </Link>
            <Link href="/runs">
              <Button type="button">
                <Play className="h-4 w-4" />
                Exécutions
              </Button>
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-card/50 animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Link href="/runs">
            <StatCard label="Runs aujourd'hui" value={stats.runs_today} icon={Play} tone="primary" className="h-full cursor-pointer" />
          </Link>
          <StatCard
            label="Taux de succès"
            value={`${stats.success_rate}%`}
            icon={CheckCircle2}
            tone="success"
            trend={stats.success_rate >= 90 ? "up" : stats.success_rate >= 60 ? "neutral" : "down"}
            trendLabel={`${stats.success_rate}%`}
          />
          <Link href="/runs">
            <StatCard label="En cours" value={stats.running_jobs} icon={Activity} tone="accent" className="h-full cursor-pointer" />
          </Link>
          <Link href="/runs">
            <StatCard
              label="Échecs"
              value={stats.failed_jobs}
              icon={AlertTriangle}
              tone="destructive"
              trend={stats.failed_jobs > 0 ? "down" : "neutral"}
              trendLabel={stats.failed_jobs > 0 ? "À surveiller" : "Aucun"}
              className="h-full cursor-pointer"
            />
          </Link>
          <Link href="/workers">
            <StatCard label="Workers en ligne" value={stats.online_workers} icon={Server} tone="info" className="h-full cursor-pointer" />
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Exécutions récentes</CardTitle>
            <Link href="/runs">
              <Button variant="ghost" size="sm" type="button" className="text-muted-foreground">
                Tout voir
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <DataTableSkeleton rows={6} />
            ) : runs.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground mb-4">Aucune exécution récente</p>
                <Link href="/jobs">
                  <Button variant="outline" type="button">Lancer un job</Button>
                </Link>
              </div>
            ) : (
              <DataTable>
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Statut</th>
                    <th>Déclencheur</th>
                    <th>Durée</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => {
                    const job = jobMap.get(r.job_id);
                    return (
                      <tr key={r.id}>
                        <td>
                          <Link href={`/runs/${r.id}`} className="group block max-w-[240px]">
                            <span className="block truncate font-medium text-foreground group-hover:text-primary transition-colors">
                              {job?.name ?? "Job inconnu"}
                            </span>
                            <span className="block truncate font-mono text-[11px] text-muted-foreground">
                              {job?.slug ? `${job.slug} · ` : ""}
                              {r.id.slice(0, 10)}…
                            </span>
                          </Link>
                        </td>
                        <td>
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="text-muted-foreground text-xs">{formatTrigger(r.trigger_type)}</td>
                        <td className="text-muted-foreground tabular-nums text-xs">
                          {formatDuration(r.duration_seconds)}
                        </td>
                        <td
                          className="text-muted-foreground text-xs"
                          title={new Date(r.queued_at).toLocaleString("fr-FR")}
                        >
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

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground font-medium">
                Durées récentes (s)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {durationSeries.length > 1 ? (
                <>
                  <Sparkline data={durationSeries} width={280} height={72} className="w-full" />
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{durationSeries.length} dernières runs</span>
                    <span className="tabular-nums">
                      max {Math.max(...durationSeries).toFixed(1)}s
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Pas assez de données
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 space-y-2">
              <p className="text-sm font-medium mb-3">Accès rapide</p>
              {[
                { href: "/jobs", label: "Créer un job", icon: Boxes },
                { href: "/triggers", label: "Configurer un trigger", icon: Activity },
                { href: "/workers", label: "Gérer les workers", icon: Server },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted hover:text-foreground hover:bg-card-hover transition-colors group"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="flex-1">{item.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
