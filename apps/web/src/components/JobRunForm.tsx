"use client";

import Link from "next/link";
import { GitBranch, Loader2, Play, Terminal } from "lucide-react";
import { Job, JobParameter } from "@/lib/api";
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
  onRun,
  running,
  result,
}: {
  job: Job;
  runArgs: Record<string, string>;
  setRunArgs: (v: Record<string, string>) => void;
  onRun: () => void;
  running: boolean;
  result: string;
}) {
  const hasParams = job.parameters.length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lancer une exécution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasParams ? (
            <p className="text-sm text-muted-foreground">
              Ce job n&apos;a pas de paramètres — vous pouvez le lancer directement.
            </p>
          ) : (
            <div className="space-y-4">
              {job.parameters.map((p) => (
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
                  Lancer
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
      {param.param_type === "boolean" ? (
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
