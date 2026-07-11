"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, Play, Server } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, DashboardStats, Run } from "@/lib/api";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getStats(), api.getRecentRuns()])
      .then(([s, r]) => {
        setStats(s);
        setRuns(r);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de votre plateforme d'automatisation"
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard label="Runs aujourd'hui" value={stats.runs_today} icon={Play} />
          <StatCard label="Taux de succès" value={`${stats.success_rate}%`} icon={CheckCircle2} trend="up" />
          <StatCard label="En cours" value={stats.running_jobs} icon={Activity} />
          <StatCard label="Échecs" value={stats.failed_jobs} icon={AlertTriangle} trend={stats.failed_jobs > 0 ? "down" : "neutral"} />
          <StatCard label="Workers en ligne" value={stats.online_workers} icon={Server} />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Exécutions récentes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucune exécution récente</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="pb-3 font-medium">ID</th>
                  <th className="pb-3 font-medium">Statut</th>
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
                    <td className="py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {r.duration_seconds?.toFixed(1) ?? "—"}s
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(r.queued_at).toLocaleString("fr-FR")}
                    </td>
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
