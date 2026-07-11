"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, DashboardStats, Run } from "@/lib/api";
import Link from "next/link";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
    api.getRecentRuns().then(setRuns).catch(console.error);
  }, []);

  return (
    <AppShell>
      <h2 className="text-xl font-bold mb-6">Dashboard</h2>
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Runs aujourd'hui", value: stats.runs_today },
            { label: "Taux de succès", value: `${stats.success_rate}%` },
            { label: "En cours", value: stats.running_jobs },
            { label: "Échecs", value: stats.failed_jobs },
            { label: "Workers online", value: stats.online_workers },
          ].map((s) => (
            <div key={s.label} className="p-4 bg-card border border-border rounded">
              <p className="text-sm text-muted">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      )}
      <h3 className="text-lg font-semibold mb-4">Runs récents</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted border-b border-border">
            <th className="pb-2">ID</th>
            <th className="pb-2">Status</th>
            <th className="pb-2">Durée</th>
            <th className="pb-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-b border-border/50">
              <td className="py-2">
                <Link href={`/runs/${r.id}`} className="text-primary hover:underline">
                  {r.id.slice(0, 8)}...
                </Link>
              </td>
              <td className="py-2">
                <StatusBadge status={r.status} />
              </td>
              <td className="py-2">{r.duration_seconds?.toFixed(1) ?? "-"}s</td>
              <td className="py-2">{new Date(r.queued_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: "text-green-400",
    failed: "text-red-400",
    running: "text-blue-400",
    queued: "text-yellow-400",
  };
  return <span className={colors[status] || "text-muted"}>{status}</span>;
}
