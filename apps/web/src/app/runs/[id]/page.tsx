"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { api, Run, streamRunLogs } from "@/lib/api";

interface LogEntry {
  sequence: number;
  stream: string;
  message: string;
  timestamp: string;
}

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState("");
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getRun(id).then(setRun).catch(console.error);
  }, [id]);

  useEffect(() => {
    const stop = streamRunLogs(
      id,
      (log) => setLogs((prev) => [...prev, log]),
      (status) => setRun((prev) => (prev ? { ...prev, status } : prev)),
      () => {
        api.getRun(id).then(setRun).catch(console.error);
      }
    );
    return stop;
  }, [id]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const filtered = search
    ? logs.filter((l) => l.message.toLowerCase().includes(search.toLowerCase()))
    : logs;

  if (!run) return <AppShell><p>Chargement...</p></AppShell>;

  return (
    <AppShell>
      <h2 className="text-xl font-bold mb-2">Run {id.slice(0, 12)}...</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
        <div><span className="text-muted">Status:</span> {run.status}</div>
        <div><span className="text-muted">Exit code:</span> {run.exit_code ?? "-"}</div>
        <div><span className="text-muted">Durée:</span> {run.duration_seconds?.toFixed(1) ?? "-"}s</div>
        <div><span className="text-muted">Trigger:</span> {run.trigger_type}</div>
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-2">Arguments</h3>
        <pre className="p-3 bg-card border border-border rounded text-xs overflow-auto">
          {JSON.stringify(run.arguments, null, 2)}
        </pre>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold">Logs</h3>
          <input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1 bg-background border border-border rounded text-xs"
          />
        </div>
        <div className="h-96 overflow-auto bg-black/50 border border-border rounded p-3 font-mono text-xs">
          {filtered.map((l) => (
            <div key={l.sequence} className="flex gap-2">
              <span className="text-muted shrink-0">{new Date(l.timestamp).toLocaleTimeString()}</span>
              <span className={`shrink-0 ${l.stream === "stderr" ? "text-red-400" : "text-blue-400"}`}>
                [{l.stream}]
              </span>
              <span className="whitespace-pre-wrap">{l.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>

      {run.result && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Résultat</h3>
          <pre className="p-3 bg-card border border-border rounded text-xs overflow-auto">
            {JSON.stringify(run.result, null, 2)}
          </pre>
        </div>
      )}

      {run.error && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2 text-red-400">Erreur</h3>
          <pre className="p-3 bg-red-900/20 border border-red-800 rounded text-xs">{run.error}</pre>
        </div>
      )}
    </AppShell>
  );
}
