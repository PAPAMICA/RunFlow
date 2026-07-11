"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { api, Run } from "@/lib/api";

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    api.getRuns(statusFilter ? { status: statusFilter } : undefined).then(setRuns).catch(console.error);
  }, [statusFilter]);

  return (
    <AppShell>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Runs</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-card border border-border rounded text-sm"
        >
          <option value="">Tous</option>
          <option value="queued">queued</option>
          <option value="running">running</option>
          <option value="success">success</option>
          <option value="failed">failed</option>
        </select>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted border-b border-border">
            <th className="pb-2">ID</th>
            <th className="pb-2">Job</th>
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
                  {r.id.slice(0, 12)}...
                </Link>
              </td>
              <td className="py-2">{r.job_id.slice(0, 8)}...</td>
              <td className="py-2">{r.status}</td>
              <td className="py-2">{r.duration_seconds?.toFixed(1) ?? "-"}s</td>
              <td className="py-2">{new Date(r.queued_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
}
