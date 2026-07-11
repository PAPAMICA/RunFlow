"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Bug,
  Clock,
  Copy,
  ExternalLink,
  GitBranch,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RunLogViewer } from "@/components/RunLogViewer";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { api, Job, Run, streamRunLogs } from "@/lib/api";
import { cn } from "@/lib/utils";

const TERMINAL = new Set(["success", "failed", "timeout", "cancelled", "skipped"]);

type SideTab = "details" | "result" | "error";

function formatDuration(seconds?: number) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m} min ${s} s`;
}

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

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [logs, setLogs] = useState<Parameters<typeof RunLogViewer>[0]["logs"]>([]);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [sideTab, setSideTab] = useState<SideTab>("details");

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

  useEffect(() => {
    if (run?.error) setSideTab("error");
    else if (run?.result) setSideTab("result");
  }, [run?.error, run?.result]);

  function copyRunId() {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!run) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
          <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p>Chargement de l&apos;exécution…</p>
        </div>
      </AppShell>
    );
  }

  const isLive = !TERMINAL.has(run.status);
  const hasArgs = Object.keys(run.arguments ?? {}).length > 0;
  const sideTabs = (
    [
      { key: "details" as const, label: "Détails", show: true },
      { key: "result" as const, label: "Résultat", show: Boolean(run.result) },
      { key: "error" as const, label: "Erreur", show: Boolean(run.error) },
    ] as const
  ).filter((t) => t.show);

  return (
    <AppShell>
      <div className="flex flex-col gap-4 min-h-0">
        {/* En-tête compact */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Link href="/runs" className="inline-flex items-center gap-1 hover:text-primary transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" />
                Exécutions
              </Link>
              {job && (
                <>
                  <span>/</span>
                  <Link href={`/jobs/${job.id}`} className="hover:text-primary transition-colors truncate max-w-[200px]">
                    {job.name}
                  </Link>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
                {job ? job.name : "Exécution"}
              </h1>
              <StatusBadge status={run.status} />
              {run.debug && (
                <Badge variant="warning" className="text-[10px] gap-1">
                  <Bug className="h-3 w-3" /> debug
                </Badge>
              )}
            </div>
            {job && (
              <p className="text-xs text-muted-foreground font-mono flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{job.slug}</span>
                <span className="text-border">·</span>
                <span className="inline-flex items-center gap-1">
                  <Terminal className="h-3 w-3" />
                  {job.entrypoint}
                </span>
                <span className="text-border">·</span>
                <span>{job.runner_type}</span>
                {job.source_type === "git" && job.git_config && (
                  <>
                    <span className="text-border">·</span>
                    <span className="inline-flex items-center gap-1 truncate max-w-[240px]">
                      <GitBranch className="h-3 w-3 shrink-0" />
                      {job.git_config.branch ?? "main"}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={copyRunId}>
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copié" : id.slice(0, 10) + "…"}
            </Button>
            {job && (
              <Link href={`/jobs/${job.id}?tab=run`}>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Relancer
                </Button>
              </Link>
            )}
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
        </div>

        {/* Barre de métriques */}
        <div
          className={cn(
            "grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 rounded-xl border p-3 sm:p-4",
            isLive ? "border-primary/30 bg-primary/5" : "border-border bg-card/40"
          )}
        >
          <Metric label="Code de sortie" value={run.exit_code ?? "—"} highlight={
            run.exit_code === 0 ? "success" : run.exit_code != null ? "error" : undefined
          } />
          <Metric label="Durée" value={formatDuration(run.duration_seconds)} icon={Clock} />
          <Metric label="Déclencheur" value={formatTrigger(run.trigger_type)} />
          <Metric
            label="File d'attente"
            value={new Date(run.queued_at).toLocaleString("fr-FR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
        </div>

        {/* Logs + panneau latéral */}
        <div className="grid gap-4 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] min-h-0">
          <RunLogViewer
            logs={logs}
            status={run.status}
            search={search}
            onSearchChange={setSearch}
            debugRun={run.debug}
          />

          <Card className="flex flex-col min-h-0 lg:max-h-[calc(100dvh-17rem)] lg:overflow-hidden">
            <CardHeader className="pb-2 shrink-0">
              <Tabs
                items={sideTabs.map((t) => ({ key: t.key, label: t.label }))}
                active={sideTab}
                onChange={(k) => setSideTab(k as SideTab)}
              />
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto pt-2 pb-4">
              {sideTab === "details" && (
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Run ID</p>
                    <p className="font-mono text-xs break-all">{id}</p>
                  </div>
                  {run.started_at && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Démarré</p>
                      <p className="text-xs">{new Date(run.started_at).toLocaleString("fr-FR")}</p>
                    </div>
                  )}
                  {run.finished_at && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Terminé</p>
                      <p className="text-xs">{new Date(run.finished_at).toLocaleString("fr-FR")}</p>
                    </div>
                  )}
                  {hasArgs ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Arguments</p>
                      <pre className="text-xs font-mono bg-black/30 rounded-lg p-3 overflow-auto max-h-48">
                        {JSON.stringify(run.arguments, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Aucun argument.</p>
                  )}
                  {job && (
                    <Link
                      href={`/jobs/${job.id}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Voir le job
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              )}

              {sideTab === "result" && run.result && (
                <pre className="text-xs font-mono bg-black/30 rounded-lg p-3 overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(run.result, null, 2)}
                </pre>
              )}

              {sideTab === "error" && run.error && (
                <pre className="text-xs font-mono text-destructive/90 bg-destructive/10 rounded-lg p-3 overflow-auto whitespace-pre-wrap">
                  {run.error}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string | number;
  icon?: typeof Clock;
  highlight?: "success" | "error";
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <p
        className={cn(
          "text-lg sm:text-xl font-bold tabular-nums",
          highlight === "success" && "text-success",
          highlight === "error" && "text-destructive"
        )}
      >
        {value}
      </p>
    </div>
  );
}
