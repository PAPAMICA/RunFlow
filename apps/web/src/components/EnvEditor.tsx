"use client";

import { useState } from "react";
import { FileText, FormInput, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EnvVar, parseEnvFile, stringifyEnvFile } from "@/lib/env-file";
import { cn } from "@/lib/utils";

export interface EnvEditorProps {
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}

export function EnvEditor({ value, onChange, hint }: EnvEditorProps) {
  const [mode, setMode] = useState<"form" | "text">("form");
  const [vars, setVars] = useState<EnvVar[]>(() => {
    const parsed = parseEnvFile(value);
    return parsed.length ? parsed : [{ key: "", value: "" }];
  });

  function switchMode(next: "form" | "text") {
    if (next === "text" && mode === "form") {
      onChange(stringifyEnvFile(vars));
    }
    if (next === "form" && mode === "text") {
      const parsed = parseEnvFile(value);
      setVars(parsed.length ? parsed : [{ key: "", value: "" }]);
    }
    setMode(next);
  }

  function updateVar(index: number, patch: Partial<EnvVar>) {
    const next = vars.map((v, i) => (i === index ? { ...v, ...patch } : v));
    setVars(next);
    onChange(stringifyEnvFile(next));
  }

  function addVar() {
    const next = [...vars, { key: "", value: "" }];
    setVars(next);
  }

  function removeVar(index: number) {
    const next = vars.filter((_, i) => i !== index);
    const safe = next.length ? next : [{ key: "", value: "" }];
    setVars(safe);
    onChange(stringifyEnvFile(safe));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label>Variables d&apos;environnement (.env)</Label>
          {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          <button
            type="button"
            onClick={() => switchMode("form")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              mode === "form" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FormInput className="h-3.5 w-3.5" />
            Formulaire
          </button>
          <button
            type="button"
            onClick={() => switchMode("text")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              mode === "text" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            Texte
          </button>
        </div>
      </div>

      {mode === "form" ? (
        <div className="space-y-2 rounded-xl border border-border bg-card/40 p-3">
          {vars.map((v, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-center">
              <Input
                value={v.key}
                onChange={(e) => updateVar(i, { key: e.target.value })}
                placeholder="NOM_VARIABLE"
                className="font-mono text-xs"
              />
              <Input
                value={v.value}
                onChange={(e) => updateVar(i, { value: e.target.value })}
                placeholder="valeur"
                className="font-mono text-xs"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeVar(i)}
                disabled={vars.length <= 1 && !v.key && !v.value}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addVar}>
            <Plus className="h-3 w-3" />
            Ajouter une variable
          </Button>
        </div>
      ) : (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs min-h-[140px]"
          placeholder={"API_KEY=\nDATABASE_URL=postgres://...\n# commentaire"}
          spellCheck={false}
        />
      )}
    </div>
  );
}
