"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AskAIPanel } from "@/components/AskAIPanel";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, Job, JobFileNode, JobStats, Run } from "@/lib/api";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type Tab = "overview" | "code" | "parameters" | "runs" | "run";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [jobRuns, setJobRuns] = useState<Run[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [files, setFiles] = useState<JobFileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [runArgs, setRunArgs] = useState<Record<string, string>>({});
  const [runResult, setRunResult] = useState<string>("");

  useEffect(() => {
    api.getJob(id).then(setJob).catch(console.error);
    api.getJobStats(id).then(setStats).catch(console.error);
  }, [id]);

  useEffect(() => {
    if (tab === "code") api.listJobFiles(id).then(setFiles).catch(console.error);
    if (tab === "runs") api.getJobRuns(id).then(setJobRuns).catch(console.error);
  }, [id, tab]);

  async function loadFile(path: string) {
    const file = await api.getJobFile(id, path);
    setSelectedFile(path);
    setContent(file.content || "");
  }

  async function saveFile() {
    if (!selectedFile) return;
    await api.writeJobFile(id, selectedFile, content);
  }

  async function createFile() {
    const path = prompt("Nom du fichier (ex: main.py):");
    if (!path) return;
    await api.createJobFile(id, path, false, "");
    setFiles(await api.listJobFiles(id));
    await loadFile(path);
  }

  async function runJob() {
    if (!job) return;
    const args: Record<string, unknown> = {};
    for (const p of job.parameters) {
      if (runArgs[p.name] !== undefined) {
        if (p.param_type === "boolean") args[p.name] = runArgs[p.name] === "true";
        else if (p.param_type === "integer") args[p.name] = parseInt(runArgs[p.name], 10);
        else args[p.name] = runArgs[p.name];
      }
    }
    const result = await api.runJob(job.slug, args, true);
    setRunResult(JSON.stringify(result, null, 2));
    api.getJobStats(id).then(setStats).catch(console.error);
  }

  if (!job) return <AppShell><p>Chargement...</p></AppShell>;

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "code", label: "Code" },
    { key: "parameters", label: "Parameters" },
    { key: "runs", label: "Runs" },
    { key: "run", label: "Run" },
  ];

  return (
    <AppShell>
      <h2 className="text-xl font-bold mb-2">{job.name}</h2>
      <p className="text-muted text-sm mb-4">{job.slug} · {job.runner_type}</p>

      <div className="flex gap-2 mb-6 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats && [
              { label: "Total runs", value: stats.total_runs },
              { label: "Success rate", value: `${stats.success_rate}%` },
              { label: "Durée moyenne", value: stats.avg_duration_seconds ? `${stats.avg_duration_seconds.toFixed(1)}s` : "-" },
              { label: "Dernier run", value: stats.last_run?.status || "-" },
            ].map((s) => (
              <Card key={s.label} className="p-4">
                <p className="text-sm text-muted">{s.label}</p>
                <p className="text-xl font-bold mt-1">{s.value}</p>
              </Card>
            ))}
          </div>
          <div className="text-sm space-y-1">
            <p><span className="text-muted">Entrypoint:</span> {job.entrypoint}</p>
            <p><span className="text-muted">Description:</span> {job.description || "-"}</p>
          </div>
        </div>
      )}

      {tab === "code" && (
        <div>
        <div className="flex gap-4 h-[600px]">
          <Card className="w-48 p-2 overflow-auto">
            <Button size="sm" variant="ghost" onClick={createFile} className="mb-2 w-full">+ New File</Button>
            {files.filter((f) => !f.is_directory).map((f) => (
              <button
                key={f.path}
                onClick={() => loadFile(f.path)}
                className={`block w-full text-left text-xs py-1 px-2 rounded ${
                  selectedFile === f.path ? "bg-primary/20" : ""
                }`}
              >
                {f.path}
              </button>
            ))}
          </Card>
          <Card className="flex-1 flex flex-col overflow-hidden">
            {selectedFile ? (
              <>
                <div className="flex justify-between items-center px-3 py-2 border-b border-border">
                  <span className="text-sm">{selectedFile}</span>
                  <Button size="sm" onClick={saveFile}>Save</Button>
                </div>
                <MonacoEditor
                  height="100%"
                  language={selectedFile.endsWith(".py") ? "python" : "plaintext"}
                  theme="vs-dark"
                  value={content}
                  onChange={(v) => setContent(v || "")}
                />
              </>
            ) : (
              <p className="p-4 text-muted text-sm">Sélectionnez un fichier</p>
            )}
          </Card>
        </div>
        <AskAIPanel jobId={id} selectedFile={selectedFile} />
        </div>
      )}

      {tab === "parameters" && (
        <div className="text-sm space-y-2">
          {job.parameters.length === 0 ? (
            <p className="text-muted">Aucun paramètre défini</p>
          ) : (
            job.parameters.map((p) => (
              <Card key={p.id} className="p-3">
                <span className="font-medium">{p.name}</span>
                <span className="text-muted ml-2">({p.param_type})</span>
                {p.required && <span className="text-red-400 ml-2">required</span>}
              </Card>
            ))
          )}
        </div>
      )}

      {tab === "runs" && (
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
            {jobRuns.map((r) => (
              <tr key={r.id} className="border-b border-border/50">
                <td className="py-2">
                  <Link href={`/runs/${r.id}`} className="text-primary hover:underline">
                    {r.id.slice(0, 12)}...
                  </Link>
                </td>
                <td className="py-2">{r.status}</td>
                <td className="py-2">{r.duration_seconds?.toFixed(1) ?? "-"}s</td>
                <td className="py-2">{new Date(r.queued_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "run" && (
        <div className="max-w-lg space-y-4">
          {job.parameters.map((p) => (
            <label key={p.id} className="block">
              <span className="text-sm text-muted">{p.label || p.name}</span>
              {p.param_type === "boolean" ? (
                <select
                  value={runArgs[p.name] || "false"}
                  onChange={(e) => setRunArgs({ ...runArgs, [p.name]: e.target.value })}
                  className="block w-full mt-1 h-9 px-3 bg-background border border-border rounded text-sm"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : p.param_type === "select" && p.options ? (
                <select
                  value={runArgs[p.name] || ""}
                  onChange={(e) => setRunArgs({ ...runArgs, [p.name]: e.target.value })}
                  className="block w-full mt-1 h-9 px-3 bg-background border border-border rounded text-sm"
                >
                  {p.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <Input
                  type={p.param_type === "secret" ? "password" : "text"}
                  value={runArgs[p.name] || ""}
                  onChange={(e) => setRunArgs({ ...runArgs, [p.name]: e.target.value })}
                  className="mt-1"
                />
              )}
            </label>
          ))}
          <Button onClick={runJob}>Lancer le Job</Button>
          {runResult && (
            <pre className="p-4 bg-card border border-border rounded text-xs overflow-auto">{runResult}</pre>
          )}
        </div>
      )}
    </AppShell>
  );
}
