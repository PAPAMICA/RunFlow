"use client";

import { Job, JobParameter } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

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
  if (job.parameters.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Aucun argument requis — lancement direct.</p>
        <Button onClick={onRun} disabled={running}>
          {running ? "Exécution…" : "Lancer le job"}
        </Button>
        {result && (
          <pre className="p-4 rounded-xl border border-border bg-card font-mono text-xs overflow-auto max-h-64">
            {result}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-4">
      {job.parameters.map((p) => (
        <ParameterField
          key={p.id}
          param={p}
          value={runArgs[p.name] ?? String(p.default_value ?? "")}
          onChange={(v) => setRunArgs({ ...runArgs, [p.name]: v })}
        />
      ))}
      <Button onClick={onRun} disabled={running}>
        {running ? "Exécution…" : "Lancer le job"}
      </Button>
      {result && (
        <pre className="p-4 rounded-xl border border-border bg-card font-mono text-xs overflow-auto max-h-64">
          {result}
        </pre>
      )}
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
    <div className="space-y-2">
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
          type={param.param_type === "secret" || param.param_type === "integer" ? param.param_type === "integer" ? "number" : "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
