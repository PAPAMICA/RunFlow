"use client";

import { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-card/50 animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard label="Runs aujourd'hui" value={stats.runs_today} icon={Play} />
          <StatCard label="Taux de succès" value={`${stats.success_rate}%`} icon={CheckCircle2} trend="up" />
          <StatCard label="En cours" value={stats.running_jobs} icon={Activity} />
          <StatCard
            label="Échecs"
            value={stats.failed_jobs}
            icon={AlertTriangle}
            trend={stats.failed_jobs > 0 ? "down" : "neutral"}
          />
          <StatCard label="Workers en ligne" value={stats.online_workers} icon={Server} />
        </div>
      ) : null}

      <Card>
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
            <DataTableSkeleton rows={5} />
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
                  <th>ID</th>
                  <th>Statut</th>
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
