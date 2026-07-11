"use client";

import { useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { api, Job, JobParameterInput } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface EditableParam extends JobParameterInput {
  enabled: boolean;
  param_type: string;
  required: boolean;
}

function fromJob(job: Job): EditableParam[] {
  return [...job.parameters]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((p) => ({
      name: p.name,
      label: p.label ?? "",
      description: p.description ?? "",
      param_type: p.param_type ?? "string",
      required: p.required ?? false,
      default_value:
        p.default_value == null ? "" : String(p.default_value),
      options: p.options ?? [],
      enabled: p.enabled !== false,
    }));
}

function emptyParam(): EditableParam {
  return {
    name: "",
    label: "",
    description: "",
    param_type: "string",
    required: false,
    default_value: "",
    options: [],
    enabled: true,
  };
}

const NEEDS_OPTIONS = new Set(["select", "multi_select"]);

export function JobParametersEditor({
  job,
  onSaved,
}: {
  job: Job;
  onSaved: (updated: Job) => void;
}) {
  const [params, setParams] = useState<EditableParam[]>(() => fromJob(job));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  function update(i: number, patch: Partial<EditableParam>) {
    setParams((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));
    setMsg("");
  }

  function remove(i: number) {
    setParams((prev) => prev.filter((_, j) => j !== i));
    setMsg("");
  }

  function move(i: number, dir: -1 | 1) {
    setParams((prev) => {
      const next = [...prev];
      const target = i + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[i], next[target]] = [next[target], next[i]];
      return next;
    });
    setMsg("");
  }

  async function save() {
    setError("");
    setMsg("");
    const cleaned = params
      .map((p) => ({ ...p, name: p.name.trim() }))
      .filter((p) => p.name);

    const names = cleaned.map((p) => p.name);
    const dup = names.find((n, idx) => names.indexOf(n) !== idx);
    if (dup) {
      setError(`Nom de paramètre en double : ${dup}`);
      return;
    }

    const payload: JobParameterInput[] = cleaned.map((p, idx) => ({
      name: p.name,
      label: p.label || undefined,
      description: p.description || undefined,
      param_type: p.param_type,
      required: p.required,
      default_value:
        p.default_value === "" || p.default_value == null
          ? undefined
          : p.default_value,
      options: NEEDS_OPTIONS.has(p.param_type)
        ? (p.options ?? []).filter(Boolean)
        : undefined,
      position: idx,
      enabled: p.enabled,
    }));

    setSaving(true);
    try {
      const updated = await api.updateJob(job.id, { parameters: payload });
      onSaved(updated);
      setParams(fromJob(updated));
      setMsg("Paramètres enregistrés");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Paramètres du job</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Éditez les arguments, réordonnez-les et activez/désactivez-les.
              Un argument désactivé n&apos;est pas demandé au lancement ni transmis au script.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setParams((p) => [...p, emptyParam()])}>
            <Plus className="h-3 w-3" />
            Ajouter
          </Button>
        </div>

        {params.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-4 py-6 text-center">
            Aucun paramètre. Ajoutez-en un ou synchronisez la source du job.
          </p>
        ) : (
          <div className="space-y-3">
            {params.map((p, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg border p-3 transition-colors",
                  p.enabled
                    ? "border-border bg-card"
                    : "border-border-subtle bg-card/40 opacity-70"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 pt-1.5">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Monter"
                    >
                      ▲
                    </button>
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === params.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Descendre"
                    >
                      ▼
                    </button>
                  </div>

                  <div className="flex-1 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Nom (argument)</Label>
                      <Input
                        value={p.name}
                        onChange={(e) => update(i, { name: e.target.value })}
                        placeholder="cal_only"
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={p.label ?? ""}
                        onChange={(e) => update(i, { label: e.target.value })}
                        placeholder="Calendriers uniquement"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={p.param_type}
                        onChange={(e) => update(i, { param_type: e.target.value })}
                      >
                        <option value="string">Texte</option>
                        <option value="integer">Entier</option>
                        <option value="float">Décimal</option>
                        <option value="boolean">Booléen (valeur true/false)</option>
                        <option value="flag">Flag (présent/absent)</option>
                        <option value="select">Liste</option>
                        <option value="multi_select">Liste multiple</option>
                        <option value="secret">Secret</option>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Valeur par défaut</Label>
                      <Input
                        value={
                          p.default_value == null ? "" : String(p.default_value)
                        }
                        onChange={(e) => update(i, { default_value: e.target.value })}
                        placeholder={p.param_type === "flag" ? "false" : "—"}
                        className="text-xs"
                      />
                    </div>
                    {NEEDS_OPTIONS.has(p.param_type) && (
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Options (séparées par des virgules)</Label>
                        <Input
                          value={(p.options ?? []).join(", ")}
                          onChange={(e) =>
                            update(i, {
                              options: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="prod, staging, dev"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3 pl-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(i)}
                      aria-label="Supprimer le paramètre"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-border-subtle pl-9">
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      onChange={(e) => update(i, { enabled: e.target.checked })}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    {p.enabled ? "Activé" : "Désactivé"}
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={p.required}
                      onChange={(e) => update(i, { required: e.target.checked })}
                      disabled={!p.enabled}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    Requis
                  </label>
                  {p.name && (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      CLI : {p.param_type === "flag"
                        ? `--${p.name.replace(/_/g, "-")}`
                        : `--${p.name.replace(/_/g, "-")} <valeur>`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer les paramètres"}
          </Button>
          {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
