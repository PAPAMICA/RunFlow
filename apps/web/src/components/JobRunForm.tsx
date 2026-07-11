"use client";

import Link from "next/link";
import { GitBranch, Loader2, Lock, Play, Terminal, Bug } from "lucide-react";
import { Job, JobParameter } from "@/lib/api";
import { canLaunchDirectly, getUserFacingParameters } from "@/lib/job-args";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function JobRunForm({
  job,
  runArgs,
  setRunArgs,
  debug,
  setDebug,
  onRun,
  running,
  result,
}: {
  job: Job;
  runArgs: Record<string, string>;
  setRunArgs: (v: Record<string, string>) => void;
  debug: boolean;
  setDebug: (v: boolean) => void;
  onRun: () => void;
  running: boolean;
  result: string;
}) {
  const userParams = getUserFacingParameters(job);
  const forced = job.forced_arguments ?? {};
  const forcedEntries = Object.entries(forced);
  const directLaunch = canLaunchDirectly(job);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lancer une exécution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {forcedEntries.length > 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-2">
              <p className="text-xs font-medium flex items-center gap-1.5 text-warning">
                <Lock className="h-3.5 w-3.5" />
                Arguments forcés (toujours appliqués)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {forcedEntries.map(([key, value]) => (
                  <Badge key={key} variant="muted" className="font-mono text-[10px]">
                    {key}={String(value)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {directLaunch ? (
            <p className="text-sm text-muted-foreground">
              Tous les arguments sont forcés — lancez directement sans saisie.
            </p>
          ) : (
            <div className="space-y-4">
              {userParams.map((p) => (
                <ParameterField
                  key={p.id}
                  param={p}
                  value={runArgs[p.name] ?? String(p.default_value ?? "")}
                  onChange={(v) => setRunArgs({ ...runArgs, [p.name]: v })}
                />
              ))}
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {result}
            </div>
          )}

          <label className="flex items-start gap-3 rounded-lg border border-border-subtle p-4 cursor-pointer hover:border-primary/30 transition-colors">
            <input
              type="checkbox"
              checked={debug}
              onChange={(e) => setDebug(e.target.checked)}
              className="accent-primary mt-0.5"
            />
            <div className="space-y-1">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <Bug className="h-3.5 w-3.5 text-warning" />
                Mode debug
              </span>
              <p className="text-xs text-muted-foreground">
                Arborescence des fichiers, commande Docker, variables d&apos;environnement,
                stdout en direct et résumé post-exécution.
              </p>
            </div>
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button size="lg" onClick={onRun} disabled={running} className="min-w-[160px]">
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Lancement…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  {directLaunch ? "Lancer maintenant" : "Lancer"}
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Vous serez redirigé vers la page d&apos;exécution avec les logs en direct.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Résumé</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary shrink-0" />
              <span className="font-mono text-xs">{job.entrypoint}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="accent">{job.runner_type}</Badge>
              <Badge variant="muted">{job.source_type}</Badge>
              {job.has_env_file && <Badge variant="default">.env</Badge>}
            </div>
            {job.git_config && (
              <p className="flex items-start gap-2 text-xs text-muted-foreground break-all">
                <GitBranch className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {job.git_config.repository_url}
                {job.git_config.branch && (
                  <span className="text-foreground/70">@{job.git_config.branch}</span>
                )}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Timeout : {job.timeout_seconds ?? 300}s
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <Link
              href={`/jobs/${job.id}`}
              className="text-sm text-primary hover:underline"
            >
              Voir l&apos;historique des exécutions →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ParameterField({
  param,
  value,
  onChange,
}: {
  param: JobParameter;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border-subtle p-4">
      <Label>
        {param.label || param.name}
        {param.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {param.description && (
        <p className="text-xs text-muted-foreground">{param.description}</p>
      )}
      {param.param_type === "flag" ? (
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          <span className="text-muted-foreground">
            {value === "true"
              ? `Ajoute --${param.name.replace(/_/g, "-")}`
              : "Désactivé (option absente)"}
          </span>
        </label>
      ) : param.param_type === "boolean" ? (
        <Select value={value || "false"} onChange={(e) => onChange(e.target.value)}>
          <option value="true">true</option>
          <option value="false">false</option>
        </Select>
      ) : param.param_type === "select" && param.options ? (
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          {param.options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </Select>
      ) : (
        <Input
          type={
            param.param_type === "integer"
              ? "number"
              : param.param_type === "secret"
                ? "password"
                : "text"
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
