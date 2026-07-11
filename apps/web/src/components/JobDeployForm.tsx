"use client";

import { useState } from "react";
import { GitBranch, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, JobParameterInput, Project } from "@/lib/api";

export interface JobDeployFormProps {
  projects: Project[];
  onCreated: (jobId: string) => void;
  onCancel: () => void;
}

const emptyParam = (): JobParameterInput => ({
  name: "",
  label: "",
  param_type: "string",
  required: false,
  position: 0,
});

export function JobDeployForm({ projects, onCreated, onCancel }: JobDeployFormProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [sourceType, setSourceType] = useState<"internal" | "git">("git");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [repoPath, setRepoPath] = useState("");
  const [entrypoint, setEntrypoint] = useState("main.py");
  const [envContent, setEnvContent] = useState("API_KEY=\nDATABASE_URL=\n");
  const [parameters, setParameters] = useState<JobParameterInput[]>([
    { name: "message", label: "Message", param_type: "string", required: false, position: 0 },
  ]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateParam(index: number, patch: Partial<JobParameterInput>) {
    setParameters((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const job = await api.createJob({
        project_id: projectId,
        name,
        slug,
        runner_type: "python",
        source_type: sourceType,
        entrypoint,
        git_config:
          sourceType === "git"
            ? { repository_url: repoUrl, branch, path: repoPath }
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
            <CardTitle>Déployer un job Python</CardTitle>
            <CardDescription>
              Clone Git, script Python, arguments et fichier .env
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                }}
                placeholder="Mon job"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Projet</Label>
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as "internal" | "git")}
              >
                <option value="git">Dépôt Git</option>
                <option value="internal">Fichiers internes</option>
              </Select>
            </div>
          </div>

          {sourceType === "git" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 rounded-xl border border-border bg-card/50 p-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>URL du dépôt Git</Label>
                <Input
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/org/repo.git"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Branche</Label>
                <Input value={branch} onChange={(e) => setBranch(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Sous-dossier (optionnel)</Label>
                <Input value={repoPath} onChange={(e) => setRepoPath(e.target.value)} placeholder="src/job" />
              </div>
              <div className="space-y-2">
                <Label>Script Python (entrypoint)</Label>
                <Input value={entrypoint} onChange={(e) => setEntrypoint(e.target.value)} placeholder="main.py" required />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Fichier .env (injecté à l&apos;exécution, non versionné)</Label>
            <Textarea
              value={envContent}
              onChange={(e) => setEnvContent(e.target.value)}
              className="font-mono text-xs min-h-[100px]"
              placeholder="KEY=value"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Arguments du script</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setParameters((p) => [...p, emptyParam()])}
              >
                <Plus className="h-3 w-3" />
                Ajouter
              </Button>
            </div>
            {parameters.map((param, i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-4 items-end rounded-lg border border-border-subtle p-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nom</Label>
                  <Input
                    value={param.name}
                    onChange={(e) => updateParam(i, { name: e.target.value })}
                    placeholder="message"
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
                    <option value="boolean">Booléen</option>
                    <option value="select">Liste</option>
                    <option value="secret">Secret</option>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setParameters((p) => p.filter((_, j) => j !== i))}
                  disabled={parameters.length <= 1}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>

          {error && (
            <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Création…" : "Déployer le job"}
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
