"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

interface Props {
  jobId: string;
  selectedFile: string | null;
}

export function AskAIPanel({ jobId, selectedFile }: Props) {
  const [prompt, setPrompt] = useState("");
  const [providerId, setProviderId] = useState("");
  const [changes, setChanges] = useState<{ path: string; content: string }[]>([]);
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);

  async function loadProviders() {
    const p = await api.getAIProviders();
    setProviders(p);
    if (p[0]) setProviderId(p[0].id);
  }

  async function ask() {
    if (!providerId) await loadProviders();
    const result = await api.askAI(providerId, prompt, jobId, selectedFile || undefined);
    setChanges(result.changes);
  }

  async function apply() {
    await api.applyAIChanges(jobId, changes);
    setChanges([]);
    setPrompt("");
  }

  if (!open) {
    return <Button size="sm" variant="outline" onClick={() => { setOpen(true); loadProviders(); }}>Ask AI</Button>;
  }

  return (
    <Card className="p-4 mt-4">
      <h4 className="font-semibold mb-2">Ask AI</h4>
      <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Décrivez les modifications..." className="mb-2" />
      <div className="flex gap-2 mb-3">
        <Button size="sm" onClick={ask}>Générer</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Fermer</Button>
      </div>
      {changes.map((c) => (
        <div key={c.path} className="mb-2 p-2 bg-background rounded text-xs">
          <p className="font-medium mb-1">{c.path}</p>
          <pre className="overflow-auto max-h-32">{c.content.slice(0, 500)}{c.content.length > 500 ? "..." : ""}</pre>
        </div>
      ))}
      {changes.length > 0 && (
        <div className="flex gap-2">
          <Button size="sm" onClick={apply}>Apply</Button>
          <Button size="sm" variant="outline" onClick={() => setChanges([])}>Cancel</Button>
        </div>
      )}
    </Card>
  );
}
