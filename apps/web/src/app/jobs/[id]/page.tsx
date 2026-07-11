"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GitBranch, Play, Save } from "lucide-react";
import { AskAIPanel } from "@/components/AskAIPanel";
import { AppShell } from "@/components/AppShell";
import { DataTable } from "@/components/DataTable";
import { JobRunForm } from "@/components/JobRunForm";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, Job, JobFileNode, JobStats, Run } from "@/lib/api";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type Tab = "overview" | "source" | "code" | "parameters" | "runs" | "run";

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
  const [runResult, setRunResult] = useState("");
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [repoPath, setRepoPath] = useState("");
  const [entrypoint, setEntrypoint] = useState("main.py");
  const [envContent, setEnvContent] = useState("");

  function loadJob() {
    api.getJob(id).then((j) => {
      setJob(j);
      setEntrypoint(j.entrypoint);
      if (j.git_config) {
        setRepoUrl(j.git_config.repository_url);
        setBranch(j.git_config.branch ?? "main");
        setRepoPath(j.git_config.path ?? "");
      }
      const defaults: Record<string, string> = {};
      for (const p of j.parameters) {
        if (p.default_value != null) defaults[p.name] = String(p.default_value);
      }
      setRunArgs(defaults);
    }).catch(console.error);
    api.getJobStats(id).then(setStats).catch(console.error);
  }

  useEffect(() => { loadJob(); }, [id]);

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

  async function runJob() {
    if (!job) return;
    setRunning(true);
    setRunResult("Mise en file d'attente…");
    try {
      const args: Record<string, unknown> = {};
      for (const p of job.parameters) {
        const raw = runArgs[p.name];
        if (raw === undefined || raw === "") continue;
        if (p.param_type === "boolean") args[p.name] = raw === "true";
        else if (p.param_type === "integer") args[p.name] = parseInt(raw, 10);
        else args[p.name] = raw;
      }
      const queued = await api.runJob(job.slug, args, false) as { run_id: string; status: string };
      router.push(`/runs/${queued.run_id}`);
    } catch (err) {
      setRunResult(err instanceof Error ? err.message : "Erreur");
      setRunning(false);
    }
  }

  if (!job) {
    return (
      <AppShell>
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-48 bg-card rounded-lg" />
          <div className="h-4 w-72 bg-card rounded" />
          <div className="h-64 bg-card rounded-xl" />
        </div>
      </AppShell>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Vue d'ensemble" },
    { key: "source", label: "Source & .env" },
    { key: "code", label: "Code" },
    { key: "parameters", label: "Paramètres" },
    { key: "runs", label: "Exécutions" },
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
          <Button onClick={() => setTab("run")} size="lg">
            <Play className="h-4 w-4" />
            Lancer
          </Button>
        }
      />

      <div className="mb-6 pb-2 border-b border-border">
        <Tabs
          items={tabs.map((t) => ({ key: t.key, label: t.label }))}
          active={tab}
          onChange={(k) => setTab(k as Tab)}
        />
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats && [
              { label: "Total runs", value: stats.total_runs },
              { label: "Taux de succès", value: `${stats.success_rate}%` },
              { label: "Durée moyenne", value: stats.avg_duration_seconds ? `${stats.avg_duration_seconds.toFixed(1)}s` : "—" },
              { label: "Dernier run", value: stats.last_run?.status ?? "—" },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-5">
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="pt-5 space-y-2 text-sm">
              <p><span className="text-muted-foreground">Entrypoint :</span> <code className="font-mono">{job.entrypoint}</code></p>
              <p><span className="text-muted-foreground">Source :</span> {job.source_type}</p>
              {job.git_config && (
                <p className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-primary" />
                  <code className="font-mono text-xs">{job.git_config.repository_url}</code>
                </p>
              )}
              {job.has_env_file && <Badge variant="accent">.env configuré</Badge>}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "source" && (
        <Card className="max-w-2xl">
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
        <Card className="max-w-lg">
          <CardContent className="pt-5 space-y-3">
            {job.parameters.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun paramètre — ajoutez-en lors du déploiement.</p>
            ) : (
              job.parameters.map((p) => (
                <div key={p.id} className="rounded-lg border border-border-subtle p-3">
                  <p className="font-medium font-mono">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.label} · {p.param_type}
                    {p.required && " · requis"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {tab === "runs" && (
        <Card>
          <CardContent className="pt-5">
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
                {jobRuns.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/runs/${r.id}`} className="link-mono text-xs">
                        {r.id.slice(0, 10)}…
                      </Link>
                    </td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="text-muted-foreground tabular-nums">{r.duration_seconds?.toFixed(1) ?? "—"}s</td>
                    <td className="text-muted-foreground text-xs">{new Date(r.queued_at).toLocaleString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </CardContent>
        </Card>
      )}

      {tab === "run" && (
        <JobRunForm
          job={job}
          runArgs={runArgs}
          setRunArgs={setRunArgs}
          onRun={runJob}
          running={running}
          result={runResult}
        />
      )}
    </AppShell>
  );
}
