"use client";

import { useEffect, useState } from "react";
import {
  Boxes,
  FileCode,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Terminal,
  Trash2,
} from "lucide-react";
import { EnvEditor } from "@/components/EnvEditor";
import {
  buildGitAuthPayload,
  GitAuthMode,
  GitAuthSection,
  validateGitAuth,
} from "@/components/GitAuthSection";
import { GitPreviewTree } from "@/components/GitPreviewTree";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api, Credential, GitPreviewResponse, JobParameterInput, Project } from "@/lib/api";
import { envExampleToText } from "@/lib/env-file";
import { cn } from "@/lib/utils";

export interface JobDeployFormProps {
  projects: Project[];
  onCreated: (jobId: string) => void;
  onCancel: () => void;
}

type RunnerType = "python" | "bash" | "ansible";
type SourceType = "internal" | "git";

const RUNNER_OPTIONS: { id: RunnerType; label: string; icon: typeof Terminal; entry: string }[] = [
  { id: "python", label: "Python", icon: FileCode, entry: "main.py" },
  { id: "bash", label: "Bash", icon: Terminal, entry: "main.sh" },
  { id: "ansible", label: "Ansible", icon: Boxes, entry: "playbook.yml" },
];

const emptyParam = (position = 0): JobParameterInput => ({
  name: "",
  label: "",
  param_type: "string",
  required: false,
  position,
});

export function JobDeployForm({ projects, onCreated, onCancel }: JobDeployFormProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [runnerType, setRunnerType] = useState<RunnerType>("python");
  const [useGit, setUseGit] = useState(true);
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [repoPath, setRepoPath] = useState("");
  const [gitToken, setGitToken] = useState("");
  const [gitUsername, setGitUsername] = useState("");
  const [gitAuthMode, setGitAuthMode] = useState<GitAuthMode>("token");
  const [gitCredentialId, setGitCredentialId] = useState("");
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [entrypoint, setEntrypoint] = useState("main.py");
  const [envContent, setEnvContent] = useState("");
  const [parameters, setParameters] = useState<JobParameterInput[]>([]);
  const [preview, setPreview] = useState<GitPreviewResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sourceType: SourceType = useGit ? "git" : "internal";

  useEffect(() => {
    if (useGit) {
      api.getCredentials().then(setCredentials).catch(console.error);
    }
  }, [useGit]);

  function gitAuthConfig() {
    return buildGitAuthPayload(gitAuthMode, gitUsername, gitToken, gitCredentialId, repoUrl);
  }

  function selectRunner(type: RunnerType) {
    setRunnerType(type);
    const opt = RUNNER_OPTIONS.find((r) => r.id === type);
    if (opt && (!entrypoint || RUNNER_OPTIONS.some((r) => r.entry === entrypoint))) {
      setEntrypoint(opt.entry);
    }
  }

  function updateParam(index: number, patch: Partial<JobParameterInput>) {
    setParameters((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function applyPreview(data: GitPreviewResponse) {
    setPreview(data);
    if (data.entrypoint) setEntrypoint(data.entrypoint);
    if (data.env_example_content) {
      setEnvContent(envExampleToText(data.env_example_content));
    }
    if (data.detected_parameters.length) {
      setParameters(data.detected_parameters.map((p, i) => ({ ...p, position: i })));
    }
  }

  async function handleGitSync() {
    if (!repoUrl.trim()) {
      setError("Indiquez l'URL du dépôt Git");
      return;
    }
    const authError = validateGitAuth(gitAuthMode, gitToken, gitCredentialId);
    if (authError) {
      setError(authError);
      return;
    }
    setError("");
    setSyncing(true);
    try {
      const data = await api.previewGitJob({
        git_config: { repository_url: repoUrl, branch, path: repoPath, ...gitAuthConfig() },
        runner_type: runnerType,
        entrypoint: entrypoint || undefined,
      });
      applyPreview(data);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Échec de la synchronisation Git");
    } finally {
      setSyncing(false);
    }
  }

  async function refreshEntrypointAnalysis(path: string) {
    setEntrypoint(path);
    if (!useGit || !repoUrl.trim()) return;
    try {
      const data = await api.previewGitJob({
        git_config: { repository_url: repoUrl, branch, path: repoPath, ...gitAuthConfig() },
        runner_type: runnerType,
        entrypoint: path,
      });
      setPreview((prev) => (prev ? { ...prev, ...data } : data));
      if (data.detected_parameters.length) {
        setParameters(data.detected_parameters.map((p, i) => ({ ...p, position: i })));
      }
    } catch {
      /* garde l'entrypoint sélectionné */
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const authError = validateGitAuth(gitAuthMode, gitToken, gitCredentialId);
    if (useGit && authError) {
      setError(authError);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const job = await api.createJob({
        project_id: projectId,
        name,
        slug,
        runner_type: runnerType,
        source_type: sourceType,
        entrypoint,
        git_config: useGit
          ? {
              repository_url: repoUrl,
              branch,
              path: repoPath,
              ...gitAuthConfig(),
            }
          : undefined,
        env_file_content: envContent.trim() ? envContent : undefined,
        parameters: parameters.filter((p) => p.name.trim()),
      });
      onCreated(job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mb-8 border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <GitBranch className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Créer un job</CardTitle>
            <CardDescription>
              Type d&apos;exécution, source Git optionnelle, variables et arguments
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Identité */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">Identité</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="job-name">Nom</Label>
                <Input
                  id="job-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, "")
                    );
                  }}
                  placeholder="Mon job"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-slug">Slug</Label>
                <Input id="job-slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-project">Projet</Label>
                <Select
                  id="job-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  required
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </section>

          {/* Type runner */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">Type d&apos;exécution</h3>
            <div className="flex flex-wrap gap-2">
              {RUNNER_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => selectRunner(opt.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all",
                      runnerType === opt.id
                        ? "border-primary/50 bg-primary/10 text-primary shadow-sm shadow-primary/10"
                        : "border-border bg-card text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Source Git */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">Source Git</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Clone le dépôt à chaque exécution (désactivé = fichiers internes)
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={useGit}
                onClick={() => setUseGit((v) => !v)}
                className={cn(
                  "relative h-7 w-12 rounded-full transition-colors",
                  useGit ? "bg-primary" : "bg-border"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                    useGit && "translate-x-5"
                  )}
                />
              </button>
            </div>

            {useGit && (
              <div className="space-y-4 rounded-xl border border-border bg-card/40 p-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                  <div className="space-y-2">
                    <Label htmlFor="git-url">URL du dépôt</Label>
                    <Input
                      id="git-url"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="https://github.com/org/repo.git"
                      required={useGit}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGitSync}
                      disabled={syncing || !repoUrl.trim()}
                      className="w-full lg:w-auto"
                    >
                      {syncing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      {syncing ? "Synchronisation…" : "Synchroniser"}
                    </Button>
                  </div>
                </div>

                <GitAuthSection
                  repoUrl={repoUrl}
                  mode={gitAuthMode}
                  onModeChange={setGitAuthMode}
                  username={gitUsername}
                  onUsernameChange={setGitUsername}
                  token={gitToken}
                  onTokenChange={setGitToken}
                  credentialId={gitCredentialId}
                  onCredentialIdChange={setGitCredentialId}
                  credentials={credentials}
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="git-branch">Branche</Label>
                    <Input id="git-branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="git-path">Sous-dossier</Label>
                    <Input
                      id="git-path"
                      value={repoPath}
                      onChange={(e) => setRepoPath(e.target.value)}
                      placeholder="optionnel"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="entrypoint">Script (entrypoint)</Label>
                    {preview?.suggested_entrypoints.length ? (
                      <Select
                        id="entrypoint"
                        value={entrypoint}
                        onChange={(e) => refreshEntrypointAnalysis(e.target.value)}
                        required
                      >
                        {preview.suggested_entrypoints.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                        {!preview.suggested_entrypoints.includes(entrypoint) && entrypoint && (
                          <option value={entrypoint}>{entrypoint}</option>
                        )}
                      </Select>
                    ) : (
                      <Input
                        id="entrypoint"
                        value={entrypoint}
                        onChange={(e) => setEntrypoint(e.target.value)}
                        placeholder={RUNNER_OPTIONS.find((r) => r.id === runnerType)?.entry}
                        required
                      />
                    )}
                  </div>
                </div>

                {preview && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Contenu du dépôt</Label>
                      <GitPreviewTree
                        files={preview.files}
                        selectedPath={entrypoint}
                        onSelectEntrypoint={refreshEntrypointAnalysis}
                      />
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground rounded-xl border border-border bg-card/30 p-3">
                      <p>
                        <span className="text-foreground font-medium">{preview.files.length}</span> entrées
                        indexées
                      </p>
                      {preview.env_example_path && (
                        <p>
                          <span className="text-foreground font-medium">{preview.env_example_path}</span> détecté
                          — variables préremplies
                        </p>
                      )}
                      {preview.detected_parameters.length > 0 && (
                        <p>
                          <span className="text-foreground font-medium">
                            {preview.detected_parameters.length}
                          </span>{" "}
                          argument(s) extraits du script
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!useGit && (
              <div className="space-y-2">
                <Label htmlFor="entrypoint-internal">Script (entrypoint)</Label>
                <Input
                  id="entrypoint-internal"
                  value={entrypoint}
                  onChange={(e) => setEntrypoint(e.target.value)}
                  placeholder={RUNNER_OPTIONS.find((r) => r.id === runnerType)?.entry}
                  required
                />
              </div>
            )}
          </section>

          {/* Env */}
          <section>
            <EnvEditor
              key={preview?.env_example_path ?? "env"}
              value={envContent}
              onChange={setEnvContent}
              hint={
                preview?.env_example_path
                  ? `Prérempli depuis ${preview.env_example_path}`
                  : "Injecté à l'exécution, non versionné dans Git"
              }
            />
          </section>

          {/* Arguments */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Label>Arguments du script</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Détectés automatiquement depuis argparse ou les conventions Bash
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setParameters((p) => [...p, emptyParam(p.length)])}
              >
                <Plus className="h-3 w-3" />
                Ajouter
              </Button>
            </div>

            {parameters.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-4 py-6 text-center">
                Aucun argument — synchronisez Git ou ajoutez manuellement
              </p>
            ) : (
              parameters.map((param, i) => (
                <div
                  key={`${param.name}-${i}`}
                  className="grid gap-3 sm:grid-cols-[1fr_1fr_120px_auto] items-end rounded-lg border border-border bg-card/40 p-3"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">Nom</Label>
                    <Input
                      value={param.name}
                      onChange={(e) => updateParam(i, { name: e.target.value })}
                      placeholder="domain"
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={param.label ?? ""}
                      onChange={(e) => updateParam(i, { label: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={param.param_type ?? "string"}
                      onChange={(e) => updateParam(i, { param_type: e.target.value })}
                    >
                      <option value="string">Texte</option>
                      <option value="integer">Entier</option>
                      <option value="boolean">Booléen (valeur true/false)</option>
                      <option value="flag">Flag (présent/absent)</option>
                      <option value="select">Liste</option>
                      <option value="secret">Secret</option>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setParameters((p) => p.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))
            )}
          </section>

          {error && (
            <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Création…" : "Créer le job"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuler
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
