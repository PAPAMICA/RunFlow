"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export default function SecretsPage() {
  const [secrets, setSecrets] = useState<{ id: string; name: string; scope: string }[]>([]);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setSecrets(await api.getSecrets());
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createSecret({ name, value });
      setName("");
      setValue("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <AppShell>
      <h2 className="text-xl font-bold mb-6">Secrets</h2>

      <Card className="p-4 mb-6">
        <form onSubmit={handleCreate} className="grid gap-3 max-w-lg">
          <Input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input placeholder="Valeur" type="password" value={value} onChange={(e) => setValue(e.target.value)} required />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Button type="submit">Créer</Button>
        </form>
      </Card>

      <div className="space-y-2">
        {secrets.map((s) => (
          <Card key={s.id} className="p-3 flex justify-between">
            <span>{s.name}</span>
            <span className="text-muted text-sm">{s.scope}</span>
          </Card>
        ))}
        {secrets.length === 0 && <p className="text-muted">Aucun secret</p>}
      </div>
    </AppShell>
  );
}
