"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Bug,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  GitBranch,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  RotateCw,
  Terminal,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RunLogViewer } from "@/components/RunLogViewer";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { api, Job, Run, streamRunLogs } from "@/lib/api";
import { cn } from "@/lib/utils";

const TERMINAL = new Set(["success", "failed", "timeout", "cancelled", "skipped"]);

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
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [logs, setLogs] = useState<Parameters<typeof RunLogViewer>[0]["logs"]>([]);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [busy, setBusy] = useState<"cancel" | "rerun" | null>(null);
  const [actionError, setActionError] = useState("");

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
    if (typeof window !== "undefined") {
      setPanelOpen(localStorage.getItem("runflow.run.panel") !== "0");
    }
  }, []);

  function togglePanel() {
    setPanelOpen((open) => {
      const next = !open;
      if (typeof window !== "undefined") {
        localStorage.setItem("runflow.run.panel", next ? "1" : "0");
      }
      return next;
    });
  }

  function copyRunId() {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCancel() {
    setBusy("cancel");
    setActionError("");
    try {
      const updated = await api.cancelRun(id);
      setRun(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur d'annulation");
    } finally {
      setBusy(null);
    }
  }

  async function handleRerun() {
    setBusy("rerun");
    setActionError("");
    try {
      const res = await api.rerunRun(id);
      router.push(`/runs/${res.run_id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur de relance");
      setBusy(null);
    }
  }

  function buildCurl(): string {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const slug = job?.slug ?? "<job-slug>";
    const body = JSON.stringify({ arguments: run?.arguments ?? {}, debug: Boolean(run?.debug) });
    return [
      `curl -X POST '${apiUrl}/api/v1/jobs/${slug}/run' \\`,
      `  -H 'Authorization: Bearer <API_KEY>' \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  -d '${body}'`,
    ].join("\n");
  }

  function copyCurl() {
    navigator.clipboard.writeText(buildCurl());
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
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
  const isTerminal = !isLive;
  const hasArgs = Object.keys(run.arguments ?? {}).length > 0;

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
            {isLive ? (
              <Button variant="destructive" size="sm" onClick={handleCancel} disabled={busy !== null}>
                <Ban className="h-3.5 w-3.5" />
                {busy === "cancel" ? "Annulation…" : "Annuler"}
              </Button>
            ) : (
              <Button size="sm" onClick={handleRerun} disabled={busy !== null}>
                <RotateCw className={cn("h-3.5 w-3.5", busy === "rerun" && "animate-spin")} />
                {busy === "rerun" ? "Relance…" : "Relancer"}
              </Button>
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
            <Button variant="outline" size="sm" onClick={togglePanel}>
              {panelOpen ? (
                <PanelRightClose className="h-3.5 w-3.5" />
              ) : (
                <PanelRightOpen className="h-3.5 w-3.5" />
              )}
              Détails
            </Button>
          </div>
        </div>

        {actionError && (
          <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{actionError}</p>
        )}

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

        {/* Encart résultat / erreur */}
        {isTerminal && <RunOutcome run={run} />}

        {/* Logs + panneau latéral */}
        <div
          className={cn(
            "grid gap-4 min-h-0",
            panelOpen ? "lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px]" : "grid-cols-1"
          )}
        >
          <div className="min-w-0">
            <RunLogViewer
              logs={logs}
              status={run.status}
              search={search}
              onSearchChange={setSearch}
              debugRun={run.debug}
            />
          </div>

          {panelOpen && (
            <Card className="flex flex-col min-h-0 lg:max-h-[calc(100dvh-17rem)] lg:overflow-hidden">
              <CardHeader className="pb-2 shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Détails</h3>
                  <button
                    onClick={togglePanel}
                    aria-label="Réduire le panneau"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <PanelRightClose className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 overflow-y-auto pt-2 pb-4">
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
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">Reproduire via API</p>
                      <button
                        onClick={copyCurl}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Copy className="h-3 w-3" />
                        {copiedCurl ? "Copié" : "Copier"}
                      </button>
                    </div>
                    <pre className="text-[11px] font-mono bg-black/30 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                      {buildCurl()}
                    </pre>
                  </div>
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
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function RunOutcome({ run }: { run: Run }) {
  const success = run.status === "success";
  const hasResult = run.result != null && Object.keys(run.result as object).length > 0;

  if (success) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <h3 className="text-sm font-semibold">
              Exécution réussie
              {run.exit_code != null && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  code {run.exit_code}
                </span>
              )}
            </h3>
          </div>
          {hasResult ? (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Sortie du script</p>
              <pre className="text-xs font-mono bg-black/30 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                {JSON.stringify(run.result, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Le script s&apos;est terminé avec succès. Consultez les logs ci-dessous pour la sortie complète.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const statusLabel: Record<string, string> = {
    failed: "Échec",
    timeout: "Délai dépassé",
    cancelled: "Annulée",
    skipped: "Ignorée",
  };

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="h-4 w-4 shrink-0" />
          <h3 className="text-sm font-semibold">
            {statusLabel[run.status] ?? "Échec"}
            {run.exit_code != null && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                code {run.exit_code}
              </span>
            )}
          </h3>
        </div>
        {run.error ? (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Erreur</p>
            <pre className="text-xs font-mono text-destructive/90 bg-destructive/10 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all">
              {run.error}
            </pre>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {run.status === "cancelled"
              ? "L'exécution a été annulée."
              : "Aucun détail d'erreur. Consultez les logs ci-dessous."}
          </p>
        )}
      </CardContent>
    </Card>
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
