"use client";

import { useEffect, useState } from "react";
import { Copy, Plus, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiKey } from "@/lib/api";

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  async function refresh() {
    setKeys(await api.getApiKeys());
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  async function handleCreate() {
    const res = await api.createApiKey({ name });
    setNewKey(res.key);
    setName("");
    setShowCreate(false);
    await refresh();
  }

  return (
    <AppShell>
      <PageHeader
        title="Clés API"
        description="Authentification programmatique pour scripts et agents IA"
        action={
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4" />
            Nouvelle clé
          </Button>
        }
      />

      {newKey && (
        <Card className="mb-6 border-success/30 bg-success/5">
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-success mb-2">Clé API créée — copiez-la maintenant</p>
            <div className="flex gap-2">
              <code className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-xs font-mono break-all">
                {newKey}
              </code>
              <Button variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(newKey)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showCreate && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="pt-5 flex gap-4 items-end max-w-md">
            <div className="flex-1 space-y-2">
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ci-pipeline" />
            </div>
            <Button onClick={handleCreate} disabled={!name}>Créer</Button>
          </CardContent>
        </Card>
      )}

      {keys.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Aucune clé API"
          description="Générez des clés pour intégrer RunFlow à vos pipelines CI/CD ou agents."
          onAction={() => setShowCreate(true)}
          actionLabel="Créer une clé"
        />
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <Card key={k.id} hover>
              <CardContent className="pt-5 flex flex-wrap justify-between items-center gap-4">
                <div>
                  <p className="font-medium">{k.name}</p>
                  <p className="text-xs font-mono text-muted-foreground mt-1">{k.prefix}…</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {k.scopes.map((s) => (
                    <Badge key={s} variant="muted">{s}</Badge>
                  ))}
                  <StatusBadge status={k.enabled ? "enabled" : "disabled"} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
