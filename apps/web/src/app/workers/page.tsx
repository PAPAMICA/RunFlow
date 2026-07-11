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
import { cn, relativeTime } from "@/lib/utils";

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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workers.map((w) => {
            const online = w.status === "online";
            const labels = Object.entries(w.labels ?? {});
            return (
              <Card key={w.id} hover>
                <CardContent className="pt-5">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl shrink-0 ring-1",
                        online
                          ? "bg-success/10 text-success ring-success/25"
                          : "bg-surface-2 text-muted-foreground ring-border"
                      )}
                    >
                      <Server className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold truncate">{w.name}</p>
                        <StatusBadge status={w.status} />
                      </div>
                      {w.hostname && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                          {w.hostname}
                        </p>
                      )}
                    </div>
                  </div>

                  {labels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {labels.map(([k, v]) => (
                        <span
                          key={k}
                          className="rounded-md bg-surface-2 border border-border px-2 py-0.5 text-[11px] font-mono text-muted-foreground"
                        >
                          {k}={v}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border-subtle text-xs">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          w.current_runs > 0 ? "bg-accent animate-pulse-soft" : "bg-muted-foreground/40"
                        )}
                      />
                      {w.current_runs} run(s) actif(s)
                    </span>
                    <span className="flex items-center gap-3 text-muted-foreground">
                      {w.last_seen_at && <span title={new Date(w.last_seen_at).toLocaleString("fr-FR")}>{relativeTime(w.last_seen_at)}</span>}
                      {w.version && <span className="font-mono">v{w.version}</span>}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
