"use client";

import { useEffect, useState } from "react";
import {
  Boxes,
  FileCode,
  GitBranch,
  HardDrive,
  Loader2,
  Plus,
  RefreshCw,
  SlidersHorizontal,
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
import { Card, CardContent } from "@/components/ui/card";
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

const RUNNER_OPTIONS: {
  id: RunnerType;
  label: string;
  icon: typeof Terminal;
  entry: string;
  description: string;
}[] = [
  { id: "python", label: "Python", icon: FileCode, entry: "main.py", description: "Scripts .py, arguments argparse" },
  { id: "bash", label: "Bash", icon: Terminal, entry: "main.sh", description: "Scripts shell POSIX" },
  { id: "ansible", label: "Ansible", icon: Boxes, entry: "playbook.yml", description: "Playbooks & inventaires" },
];

const emptyParam = (position = 0): JobParameterInput => ({
  name: "",
  label: "",
  param_type: "string",
  required: false,
  default_value: "",
  position,
  enabled: true,
});

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  step,
}: {
  icon: typeof Terminal;
  title: string;
  description?: string;
  children: React.ReactNode;
  step: number;
}) {
  return (
    <Card>
      <CardContent className="pt-5 space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground/70 tabular-nums">
                {String(step).padStart(2, "0")}
              </span>
              <h3 className="text-sm font-semibold">{title}</h3>
            </div>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function JobDeployForm({ projects, onCreated, onCancel }: JobDeployFormProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
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

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(
        value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      );
    }
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
          ? { repository_url: repoUrl, branch, path: repoPath, ...gitAuthConfig() }
          : undefined,
        env_file_content: envContent.trim() ? envContent : undefined,
        parameters: parameters
          .filter((p) => p.name.trim())
          .map((p, i) => ({
            ...p,
            position: i,
            required: false,
            default_value:
              p.default_value === "" || p.default_value == null ? undefined : p.default_value,
          })),
      });
      onCreated(job.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = name.trim() && slug.trim() && projectId && entrypoint.trim() && (!useGit || repoUrl.trim());

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 01 — Identité */}
      <SectionCard step={1} icon={SlidersHorizontal} title="Identité" description="Nom, slug d'appel et projet de rattachement">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="job-name">Nom</Label>
            <Input id="job-name" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Sync migrations" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-slug">Slug</Label>
            <Input
              id="job-slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="sync-migrations"
              className="font-mono text-sm"
              required
            />
            <p className="text-[11px] text-muted-foreground">Utilisé pour lancer le job via l&apos;API</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-project">Projet</Label>
            <Select id="job-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Type d&apos;exécution</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {RUNNER_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = runnerType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => selectRunner(opt.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
                    active
                      ? "border-primary/50 bg-primary/10 ring-1 ring-primary/30"
                      : "border-border bg-card hover:border-border-strong hover:bg-card-hover"
                  )}
                >
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", active ? "bg-primary/20 text-primary" : "bg-surface-2 text-muted-foreground")}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium", active && "text-primary")}>{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>

      {/* 02 — Source */}
      <SectionCard
        step={2}
        icon={useGit ? GitBranch : HardDrive}
        title="Source du code"
        description="Dépôt Git cloné à chaque exécution, ou fichiers internes gérés dans RunFlow"
      >
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/40 p-1 w-fit">
          <button
            type="button"
            onClick={() => setUseGit(true)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              useGit ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <GitBranch className="h-3.5 w-3.5" />
            Dépôt Git
          </button>
          <button
            type="button"
            onClick={() => setUseGit(false)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              !useGit ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <HardDrive className="h-3.5 w-3.5" />
            Fichiers internes
          </button>
        </div>

        {useGit ? (
          <div className="space-y-4">
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
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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
                <Input id="git-path" value={repoPath} onChange={(e) => setRepoPath(e.target.value)} placeholder="optionnel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entrypoint">Script (entrypoint)</Label>
                {preview?.suggested_entrypoints.length ? (
                  <Select id="entrypoint" value={entrypoint} onChange={(e) => refreshEntrypointAnalysis(e.target.value)} required>
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
                    className="font-mono text-sm"
                    required
                  />
                )}
              </div>
            </div>

            {repoPath && (
              <p className="text-[11px] text-muted-foreground">
                L&apos;entrypoint est relatif au sous-dossier « {repoPath} ».
              </p>
            )}

            {preview && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Contenu du dépôt</Label>
                  <GitPreviewTree files={preview.files} selectedPath={entrypoint} onSelectEntrypoint={refreshEntrypointAnalysis} />
                </div>
                <div className="space-y-2 text-xs text-muted-foreground rounded-xl border border-border bg-card/30 p-3">
                  <p>
                    <span className="text-foreground font-medium">{preview.files.length}</span> entrées indexées
                  </p>
                  {preview.env_example_path && (
                    <p>
                      <span className="text-foreground font-medium">{preview.env_example_path}</span> détecté — variables préremplies
                    </p>
                  )}
                  {preview.detected_parameters.length > 0 && (
                    <p>
                      <span className="text-foreground font-medium">{preview.detected_parameters.length}</span> argument(s) extraits du script
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="entrypoint-internal">Script (entrypoint)</Label>
            <Input
              id="entrypoint-internal"
              value={entrypoint}
              onChange={(e) => setEntrypoint(e.target.value)}
              placeholder={RUNNER_OPTIONS.find((r) => r.id === runnerType)?.entry}
              className="font-mono text-sm"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Vous pourrez éditer les fichiers dans l&apos;onglet « Code » après la création.
            </p>
          </div>
        )}
      </SectionCard>

      {/* 03 — Environnement */}
      <SectionCard step={3} icon={FileCode} title="Variables d'environnement" description="Injectées à chaque exécution, jamais versionnées dans Git">
        <EnvEditor
          key={preview?.env_example_path ?? "env"}
          value={envContent}
          onChange={setEnvContent}
          hint={preview?.env_example_path ? `Prérempli depuis ${preview.env_example_path}` : "Format KEY=value"}
        />
      </SectionCard>

      {/* 04 — Arguments */}
      <SectionCard step={4} icon={SlidersHorizontal} title="Arguments" description="Détectés automatiquement depuis argparse / Bash, ou ajoutés à la main">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {parameters.length} argument{parameters.length > 1 ? "s" : ""}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => setParameters((p) => [...p, emptyParam(p.length)])}>
            <Plus className="h-3 w-3" />
            Ajouter
          </Button>
        </div>

        {parameters.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-4 py-6 text-center">
            Aucun argument — synchronisez le dépôt Git ou ajoutez-en manuellement.
          </p>
        ) : (
          <div className="space-y-2">
            {parameters.map((param, i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-[1.2fr_1.2fr_150px_1fr_auto] sm:items-end rounded-lg border border-border bg-card/40 p-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nom</Label>
                  <Input value={param.name} onChange={(e) => updateParam(i, { name: e.target.value })} placeholder="cal_only" className="font-mono text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Label</Label>
                  <Input value={param.label ?? ""} onChange={(e) => updateParam(i, { label: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={param.param_type ?? "string"} onChange={(e) => updateParam(i, { param_type: e.target.value })}>
                    <option value="string">Texte</option>
                    <option value="integer">Entier</option>
                    <option value="float">Décimal</option>
                    <option value="boolean">Booléen (true/false)</option>
                    <option value="flag">Flag (présent/absent)</option>
                    <option value="select">Liste</option>
                    <option value="multi_select">Liste multiple</option>
                    <option value="secret">Secret</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Défaut</Label>
                  {param.param_type === "flag" || param.param_type === "boolean" ? (
                    <label
                      className="flex items-center gap-1.5 text-xs cursor-pointer select-none h-9"
                      title="Activé/présent par défaut (exécutions manuelles et triggers)"
                    >
                      <input
                        type="checkbox"
                        checked={String(param.default_value) === "true"}
                        onChange={(e) =>
                          updateParam(i, { default_value: e.target.checked ? "true" : "false" })
                        }
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                      {param.param_type === "flag" ? "présent" : "true"}
                    </label>
                  ) : (
                    <Input
                      value={param.default_value == null ? "" : String(param.default_value)}
                      onChange={(e) => updateParam(i, { default_value: e.target.value })}
                      placeholder="—"
                      className="text-xs"
                    />
                  )}
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setParameters((p) => p.filter((_, j) => j !== i))} aria-label="Supprimer">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-30 -mx-5 sm:-mx-6 lg:-mx-8 -mb-5 sm:-mb-6 lg:-mb-8 mt-2 border-t border-border bg-[var(--surface-elevated)] backdrop-blur-xl">
        <div className="px-5 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          {error ? (
            <p className="text-sm text-destructive truncate flex-1">{error}</p>
          ) : (
            <p className="text-xs text-muted-foreground flex-1 truncate">
              {useGit ? "Source Git" : "Fichiers internes"} · {runnerType} · {parameters.length} argument{parameters.length > 1 ? "s" : ""}
            </p>
          )}
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Annuler
          </Button>
          <Button type="submit" disabled={loading || !canSubmit}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {loading ? "Création…" : "Créer le job"}
          </Button>
        </div>
      </div>
    </form>
  );
}
