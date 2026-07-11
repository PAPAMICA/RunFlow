"use client";

import { useEffect, useState } from "react";
import { Lock, Save } from "lucide-react";
import { Job } from "@/lib/api";
import {
  parseForcedArgumentsText,
  stringifyForcedArguments,
} from "@/lib/job-args";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ForcedArgumentsEditor({
  job,
  onSave,
}: {
  job: Job;
  onSave: (forced: Record<string, unknown>) => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setContent(stringifyForcedArguments(job.forced_arguments ?? {}));
  }, [job]);

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      const forced = parseForcedArgumentsText(content);
      await onSave(forced);
      setMsg("Arguments forcés enregistrés");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-warning" />
        <div>
          <p className="text-sm font-medium">Arguments forcés</p>
          <p className="text-xs text-muted-foreground">
            Toujours injectés au lancement — masquent les paramètres du même nom
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Format KEY=valeur (un par ligne)</Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={"cal_only=true\nenv=production"}
          className="font-mono text-xs min-h-[120px]"
        />
        <p className="text-xs text-muted-foreground">
          Booléens : true/false · Nombres · JSON : {"{"}…{"}"}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="h-3.5 w-3.5" />
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
        {msg && (
          <span className={`text-xs ${msg.includes("Erreur") ? "text-destructive" : "text-success"}`}>
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
