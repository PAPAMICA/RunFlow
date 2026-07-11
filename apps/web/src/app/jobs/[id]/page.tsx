"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  GitBranch,
  Bell,
  Bug,
  CheckCircle2,
  Clock,
  FileCode,
  Play,
  Save,
  Settings2,
  Timer,
  Trash2,
} from "lucide-react";
import { AskAIPanel } from "@/components/AskAIPanel";
import { AppShell } from "@/components/AppShell";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ForcedArgumentsEditor } from "@/components/ForcedArgumentsEditor";
import { JobParametersEditor } from "@/components/JobParametersEditor";
import { FavoriteButton } from "@/components/FavoriteButton";
import { JobNotificationsForm } from "@/components/JobNotificationsForm";
import { JobRunForm } from "@/components/JobRunForm";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, Job, JobFileNode, JobStats, Run } from "@/lib/api";
import { buildRunArguments, defaultArgsFromJob } from "@/lib/job-args";
import { formatDuration, relativeTime } from "@/lib/utils";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type Tab = "overview" | "source" | "code" | "parameters" | "runs" | "run" | "notifications";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [jobRuns, setJobRuns] = useState<Run[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [files, setFiles] = useState<JobFileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [runArgs, setRunArgs] = useState<Record<string, string>>({});
  const [runDebug, setRunDebug] = useState(false);
  const [runResult, setRunResult] = useState("");
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [repoPath, setRepoPath] = useState("");
  const [entrypoint, setEntrypoint] = useState("main.py");
  const [envContent, setEnvContent] = useState("");

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTimeout, setEditTimeout] = useState(300);
  const [editEnabled, setEditEnabled] = useState(true);
  const [editPreventConcurrent, setEditPreventConcurrent] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function loadJob() {
    api.getJob(id).then((j) => {
      setJob(j);
      setEntrypoint(j.entrypoint);
      setEditName(j.name);
      setEditDescription(j.description ?? "");
      setEditTimeout(j.timeout_seconds ?? 300);
      setEditEnabled(j.enabled);
      setEditPreventConcurrent(Boolean(j.prevent_concurrent_runs));
      if (j.git_config) {
        setRepoUrl(j.git_config.repository_url);
        setBranch(j.git_config.branch ?? "main");
        setRepoPath(j.git_config.path ?? "");
      }
      const defaults: Record<string, string> = defaultArgsFromJob(j);
      setRunArgs(defaults);
    }).catch(console.error);
    api.getJobStats(id).then(setStats).catch(console.error);
  }

  useEffect(() => { loadJob(); }, [id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tab") as Tab | null;
    const valid: Tab[] = ["overview", "source", "code", "parameters", "runs", "run", "notifications"];
    if (requested && valid.includes(requested)) setTab(requested);
  }, []);

  useEffect(() => {
    if (tab === "code") api.listJobFiles(id).then(setFiles).catch(console.error);
    if (tab === "runs") api.getJobRuns(id).then(setJobRuns).catch(console.error);
    if (tab === "source" && job?.has_env_file) {
      api.getJobFile(id, ".env").then((f) => setEnvContent(f.content ?? "")).catch(() => setEnvContent(""));
    }
  }, [id, tab, job?.has_env_file]);

  async function loadFile(path: string) {
    if (path === "[git]") return;
    const file = await api.getJobFile(id, path);
    setSelectedFile(path);
    setContent(file.content || "");
  }

  async function saveFile() {
    if (!selectedFile) return;
    await api.writeJobFile(id, selectedFile, content);
  }

  async function saveSource() {
    if (!job) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const updated = await api.updateJob(id, {
        name: editName.trim() || job.name,
        description: editDescription,
        timeout_seconds: editTimeout,
        enabled: editEnabled,
        prevent_concurrent_runs: editPreventConcurrent,
        entrypoint,
        git_config: job.source_type === "git"
          ? { repository_url: repoUrl, branch, path: repoPath }
          : undefined,
        env_file_content: envContent,
      });
      setJob(updated);
      setSaveMsg("Configuration enregistrée");
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteJob(id);
      router.push("/jobs");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Erreur de suppression");
      setDeleting(false);
    }
  }

  async function runJob() {
    if (!job) return;
    setRunning(true);
    setRunResult("Mise en file d'attente…");
    try {
      const args = buildRunArguments(job, runArgs);
      const queued = await api.runJob(job.slug, args, false, runDebug) as { run_id: string; status: string };
      router.push(`/runs/${queued.run_id}`);
    } catch (err) {
      setRunResult(err instanceof Error ? err.message : "Erreur");
      setRunning(false);
    }
  }

  if (!job) {
    return (
      <AppShell>
        <div className="space-y-6 animate-pulse">
          <div className="space-y-3">
            <div className="h-4 w-32 bg-card rounded" />
            <div className="h-8 w-64 bg-card rounded-lg" />
            <div className="h-4 w-80 bg-card rounded" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-card rounded-2xl" />
            ))}
          </div>
          <div className="h-64 bg-card rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  const tabs: { key: Tab; label: string; icon?: typeof Bell; badge?: string | number }[] = [
    { key: "overview", label: "Vue d'ensemble" },
    { key: "source", label: "Configuration" },
    { key: "code", label: "Code" },
    { key: "parameters", label: "Paramètres", badge: job.parameters.length || undefined },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "runs", label: "Exécutions", badge: stats?.total_runs || undefined },
    { key: "run", label: "Lancer" },
  ];

  return (
    <AppShell>
      <PageHeader
        title={job.name}
        description={`${job.slug} · ${job.runner_type} · ${job.source_type}`}
        breadcrumb={[
          { label: "Jobs", href: "/jobs" },
          { label: job.name },
        ]}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={job.enabled ? "enabled" : "disabled"} />
            <FavoriteButton jobId={job.id} variant="outline" />
            <Button onClick={() => setTab("source")} variant="outline">
              <Settings2 className="h-4 w-4" />
              Configurer
            </Button>
            <Button onClick={() => setTab("run")} size="lg">
              <Play className="h-4 w-4" />
              Lancer
            </Button>
          </div>
        }
      />

      <div className="mb-6 pb-2 border-b border-border">
        <Tabs
          items={tabs.map((t) => ({ key: t.key, label: t.label, icon: t.icon, badge: t.badge }))}
          active={tab}
          onChange={(k) => setTab(k as Tab)}
        />
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total runs" value={stats?.total_runs ?? "—"} icon={Play} tone="primary" />
            <StatCard
              label="Taux de succès"
              value={stats ? `${stats.success_rate}%` : "—"}
              icon={CheckCircle2}
              tone="success"
              trend={stats ? (stats.success_rate >= 90 ? "up" : stats.success_rate >= 60 ? "neutral" : "down") : undefined}
              trendLabel={stats ? `${stats.success_rate}%` : undefined}
            />
            <StatCard
              label="Durée moyenne"
              value={stats?.avg_duration_seconds ? formatDuration(stats.avg_duration_seconds) : "—"}
              icon={Clock}
              tone="accent"
            />
            <StatCard
              label="Timeout"
              value={job.timeout_seconds ? formatDuration(job.timeout_seconds) : "∞"}
              icon={Timer}
              tone="info"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 text-sm divide-y divide-border-subtle">
                <div className="flex items-center gap-3 py-2.5">
                  <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground w-28 shrink-0">Entrypoint</span>
                  <code className="font-mono text-xs truncate">{job.entrypoint}</code>
                </div>
                <div className="flex items-center gap-3 py-2.5">
                  <Play className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground w-28 shrink-0">Runner</span>
                  <code className="font-mono text-xs">{job.runner_type}</code>
                </div>
                {job.git_config && (
                  <>
                    <div className="flex items-center gap-3 py-2.5">
                      <GitBranch className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-muted-foreground w-28 shrink-0">Dépôt</span>
                      <code className="font-mono text-xs truncate">{job.git_config.repository_url}</code>
                    </div>
                    <div className="flex items-center gap-3 py-2.5">
                      <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground w-28 shrink-0">Branche</span>
                      <code className="font-mono text-xs">{job.git_config.branch ?? "main"}</code>
                      {job.git_config.path && (
                        <code className="font-mono text-xs text-muted-foreground truncate">/ {job.git_config.path}</code>
                      )}
                    </div>
                  </>
                )}
                <div className="flex items-center gap-3 py-2.5">
                  <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground w-28 shrink-0">Options</span>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={job.source_type === "git" ? "default" : "muted"}>{job.source_type}</Badge>
                    {job.has_env_file && <Badge variant="accent">.env</Badge>}
                    {(job.parameters?.length ?? 0) > 0 && (
                      <Badge variant="info">{job.parameters.length} param{job.parameters.length > 1 ? "s" : ""}</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Dernier run</CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.last_run ? (
                  <button
                    onClick={() => router.push(`/runs/${stats.last_run!.id}`)}
                    className="w-full text-left rounded-lg border border-border-subtle p-3 hover:border-border-strong hover:bg-card-hover transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={stats.last_run.status} />
                      {stats.last_run.debug && <Bug className="h-3.5 w-3.5 text-accent" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 font-mono truncate">
                      {stats.last_run.id.slice(0, 14)}…
                    </p>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>{relativeTime(stats.last_run.queued_at)}</span>
                      <span className="tabular-nums">{formatDuration(stats.last_run.duration_seconds)}</span>
                    </div>
                  </button>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">Aucune exécution</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "source" && (
        <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="min-h-[70px]"
                placeholder="À quoi sert ce job ?"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Timeout (secondes)</Label>
                <Input
                  type="number"
                  min={1}
                  value={editTimeout}
                  onChange={(e) => setEditTimeout(Number(e.target.value) || 0)}
                />
              </div>
              <div className="flex flex-col justify-end gap-3 pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editEnabled}
                    onChange={(e) => setEditEnabled(e.target.checked)}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  Job actif
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editPreventConcurrent}
                    onChange={(e) => setEditPreventConcurrent(e.target.checked)}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  Empêcher les exécutions simultanées
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Source & variables d&apos;environnement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {job.source_type === "git" && (
              <>
                <div className="space-y-2">
                  <Label>URL Git</Label>
                  <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Branche</Label>
                    <Input value={branch} onChange={(e) => setBranch(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Sous-dossier</Label>
                    <Input value={repoPath} onChange={(e) => setRepoPath(e.target.value)} />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Script Python (entrypoint)</Label>
              <Input value={entrypoint} onChange={(e) => setEntrypoint(e.target.value)} />
              {job.source_type === "git" && repoPath && (
                <p className="text-xs text-muted-foreground">
                  Relatif au sous-dossier « {repoPath} » — ex. <code className="font-mono">sync_migrations.py</code>, pas <code className="font-mono">{repoPath}/sync_migrations.py</code>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Fichier .env (injecté à chaque exécution)</Label>
              <Textarea
                value={envContent}
                onChange={(e) => setEnvContent(e.target.value)}
                className="font-mono text-xs min-h-[140px]"
                placeholder="KEY=value"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={saveSource} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
              {saveMsg && <span className="text-sm text-muted-foreground">{saveMsg}</span>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Zone de danger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              La suppression d&apos;un job efface définitivement sa configuration, ses fichiers,
              ses paramètres et son historique d&apos;exécutions. Cette action est irréversible.
            </p>
            {deleteError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{deleteError}</p>
            )}
            {confirmDelete ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">Confirmer la suppression de « {job.name} » ?</span>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  <Trash2 className="h-4 w-4" />
                  {deleting ? "Suppression…" : "Oui, supprimer"}
                </Button>
                <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  Annuler
                </Button>
              </div>
            ) : (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" />
                Supprimer ce job
              </Button>
            )}
          </CardContent>
        </Card>
        </div>
      )}

      {tab === "code" && (
        <div>
          {job.source_type === "git" ? (
            <p className="text-sm text-muted-foreground mb-4">
              Le code provient du dépôt Git. Seuls les fichiers overlay (ex. .env) sont éditables ici.
            </p>
          ) : null}
          <div className="flex gap-4 h-[560px]">
            <Card className="w-52 p-2 overflow-auto shrink-0">
              {files.map((f) => (
                <button
                  key={f.path}
                  onClick={() => loadFile(f.path)}
                  disabled={f.path === "[git]"}
                  className={`block w-full text-left text-xs py-2 px-2 rounded truncate ${
                    selectedFile === f.path ? "bg-primary/15 text-primary" : "hover:bg-card-hover"
                  } ${f.path === "[git]" ? "text-muted-foreground cursor-default" : ""}`}
                >
                  {f.path}
                </button>
              ))}
            </Card>
            <Card className="flex-1 flex flex-col overflow-hidden">
              {selectedFile && selectedFile !== "[git]" ? (
                <>
                  <div className="flex justify-between items-center px-4 py-2 border-b border-border">
                    <span className="text-sm font-mono">{selectedFile}</span>
                    <Button size="sm" onClick={saveFile}>Enregistrer</Button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <MonacoEditor
                      height="100%"
                      language={selectedFile.endsWith(".py") ? "python" : selectedFile === ".env" ? "ini" : "plaintext"}
                      theme="vs-dark"
                      value={content}
                      onChange={(v) => setContent(v || "")}
                    />
                  </div>
                </>
              ) : (
                <p className="p-6 text-muted-foreground text-sm">Sélectionnez un fichier overlay</p>
              )}
            </Card>
          </div>
          {job.source_type === "internal" && <AskAIPanel jobId={id} selectedFile={selectedFile} />}
        </div>
      )}

      {tab === "parameters" && (
        <div className="space-y-6 max-w-3xl">
          <JobParametersEditor job={job} onSaved={setJob} />
          <ForcedArgumentsEditor
            job={job}
            onSave={async (forced) => {
              const updated = await api.updateJob(id, { forced_arguments: forced });
              setJob(updated);
            }}
          />
        </div>
      )}

      {tab === "notifications" && job && (
        <JobNotificationsForm
          jobId={id}
          job={job}
          onSaved={(updated) => setJob(updated)}
        />
      )}

      {tab === "runs" && (
        <Card>
          <CardContent className="pt-5">
            {jobRuns.length === 0 ? (
              <EmptyState
                icon={Play}
                title="Aucune exécution"
                description="Ce job n'a pas encore été lancé. Lancez-le pour voir l'historique ici."
                onAction={() => setTab("run")}
                actionLabel="Lancer le job"
              />
            ) : (
              <DataTable>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Statut</th>
                    <th>Trigger</th>
                    <th>Durée</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {jobRuns.map((r) => (
                    <tr key={r.id} onClick={() => router.push(`/runs/${r.id}`)} className="cursor-pointer">
                      <td>
                        <span className="link-mono text-xs inline-flex items-center gap-1.5">
                          {r.id.slice(0, 10)}…
                          {r.debug && <Bug className="h-3 w-3 text-accent" />}
                        </span>
                      </td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="text-muted-foreground capitalize text-xs">{r.trigger_type}</td>
                      <td className="text-muted-foreground tabular-nums text-xs">{formatDuration(r.duration_seconds)}</td>
                      <td className="text-muted-foreground text-xs" title={new Date(r.queued_at).toLocaleString("fr-FR")}>
                        {relativeTime(r.queued_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "run" && (
        <JobRunForm
          job={job}
          runArgs={runArgs}
          setRunArgs={setRunArgs}
          debug={runDebug}
          setDebug={setRunDebug}
          onRun={runJob}
          running={running}
          result={runResult}
        />
      )}
    </AppShell>
  );
}
