"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Clock, Copy, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { RunLogViewer } from "@/components/RunLogViewer";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, Job, Run, streamRunLogs } from "@/lib/api";

const TERMINAL = new Set(["success", "failed", "timeout", "cancelled", "skipped"]);

function formatDuration(seconds?: number) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m} min ${s} s`;
}

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [logs, setLogs] = useState<Parameters<typeof RunLogViewer>[0]["logs"]>([]);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getRun(id).then((r) => {
      setRun(r);
      api.getJob(r.job_id).then(setJob).catch(console.error);
    }).catch(console.error);
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

  function copyRunId() {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!run) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Chargement de l&apos;exécution…</p>
      </AppShell>
    );
  }

  const isLive = !TERMINAL.has(run.status);

  return (
    <AppShell>
      <div className="mb-4">
        <Link
          href={job ? `/jobs/${job.id}` : "/runs"}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {job ? `Retour à ${job.name}` : "Retour aux exécutions"}
        </Link>
      </div>

      <PageHeader
        title={job ? job.name : "Exécution"}
        description={
          job
            ? `${job.slug} · ${job.runner_type} · ${job.entrypoint}`
            : `Run ${id.slice(0, 12)}…`
        }
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyRunId}>
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copié" : id.slice(0, 10) + "…"}
            </Button>
            {isLive && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => api.getRun(id).then(setRun).catch(console.error)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Actualiser
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className={isLive ? "border-primary/30 glow-primary" : ""}>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Statut</p>
            <StatusBadge status={run.status} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Code de sortie</p>
            <p className={`text-2xl font-bold tabular-nums ${
              run.exit_code === 0 ? "text-success" : run.exit_code != null ? "text-destructive" : ""
            }`}>
              {run.exit_code ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Durée
            </p>
            <p className="text-2xl font-bold">{formatDuration(run.duration_seconds)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Déclencheur</p>
            <p className="text-sm font-medium capitalize">{run.trigger_type}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(run.queued_at).toLocaleString("fr-FR")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="min-h-[480px]">
          <RunLogViewer
            logs={logs}
            status={run.status}
            search={search}
            onSearchChange={setSearch}
          />
        </div>

        <div className="space-y-4">
          {Object.keys(run.arguments ?? {}).length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <h3 className="text-sm font-semibold mb-2">Arguments</h3>
                <pre className="text-xs font-mono bg-black/30 rounded-lg p-3 overflow-auto max-h-40">
                  {JSON.stringify(run.arguments, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {run.result && (
            <Card>
              <CardContent className="pt-5">
                <h3 className="text-sm font-semibold mb-2 text-success">Résultat</h3>
                <pre className="text-xs font-mono bg-black/30 rounded-lg p-3 overflow-auto max-h-48">
                  {JSON.stringify(run.result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {run.error && (
            <Card className="border-destructive/40">
              <CardContent className="pt-5">
                <h3 className="text-sm font-semibold mb-2 text-destructive">Erreur</h3>
                <pre className="text-xs font-mono text-destructive/90 whitespace-pre-wrap">
                  {run.error}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
