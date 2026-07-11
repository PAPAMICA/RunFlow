"use client";

import { useEffect, useState } from "react";
import { Copy, Plus, Server } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { FormPanel } from "@/components/FormPanel";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, WorkerInfo } from "@/lib/api";

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const w = await api.getWorkers();
    setWorkers(w);
  }

  useEffect(() => {
    refresh().catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    const res = await api.createWorker({ name });
    setNewToken(res.token);
    setName("");
    setShowCreate(false);
    await refresh();
  }

  function copyToken() {
    if (newToken) navigator.clipboard.writeText(newToken);
  }

  return (
    <AppShell>
      <PageHeader
        title="Workers"
        description="Agents d'exécution distants ou intégrés au serveur"
        action={
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4" />
            Nouveau worker
          </Button>
        }
      />

      {newToken && (
        <Card className="mb-6 border-success/30 bg-success/5">
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-success mb-2">Token créé — copiez-le maintenant, il ne sera plus affiché</p>
            <div className="flex gap-2">
              <code className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-xs font-mono break-all">
                {newToken}
              </code>
              <Button variant="outline" size="icon" onClick={copyToken}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showCreate && (
        <FormPanel title="Nouveau worker" description="Génère un token d'enregistrement pour l'agent" onClose={() => setShowCreate(false)}>
          <div className="flex gap-4 items-end max-w-md">
            <div className="flex-1 space-y-2">
              <Label>Nom du worker</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="worker-prod-01" />
            </div>
            <Button onClick={handleCreate} disabled={!name}>Créer</Button>
          </div>
        </FormPanel>
      )}

      {!loading && workers.length === 0 ? (
        <EmptyState
          icon={Server}
          title="Aucun worker"
          description="Enregistrez un worker pour exécuter vos jobs sur cette machine ou à distance."
          onAction={() => setShowCreate(true)}
          actionLabel="Créer un worker"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {workers.map((w) => (
            <Card key={w.id} hover>
              <CardContent className="pt-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{w.name}</p>
                    {w.hostname && (
                      <p className="text-xs text-muted-foreground font-mono mt-1">{w.hostname}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {Object.entries(w.labels).map(([k, v]) => `${k}=${v}`).join(" · ") || "Aucun label"}
                    </p>
                  </div>
                  <StatusBadge status={w.status} />
                </div>
                <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
                  <span>{w.current_runs} run(s) actif(s)</span>
                  {w.version && <span className="font-mono text-xs">v{w.version}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
