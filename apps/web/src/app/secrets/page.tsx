"use client";

import { useEffect, useState } from "react";
import { Plus, Shield, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, Secret } from "@/lib/api";

export default function SecretsPage() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function refresh() {
    setSecrets(await api.getSecrets());
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  async function handleDelete(id: string) {
    setError("");
    try {
      await api.deleteSecret(id);
      setConfirmDelete(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createSecret({ name, value });
      setName("");
      setValue("");
      setShowCreate(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Secrets"
        description="Variables sensibles chiffrées (AES-256-GCM)"
        action={
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4" />
            Nouveau secret
          </Button>
        }
      />

      {error && !showCreate && (
        <p className="mb-4 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
      )}

      {showCreate && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="pt-5">
            <form onSubmit={handleCreate} className="grid gap-4 max-w-md">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Valeur</Label>
                <Input type="password" value={value} onChange={(e) => setValue(e.target.value)} required />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit">Créer</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {secrets.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="Aucun secret"
          description="Stockez des mots de passe et tokens de façon sécurisée pour vos jobs."
          onAction={() => setShowCreate(true)}
          actionLabel="Ajouter un secret"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {secrets.map((s) => (
            <Card key={s.id}>
              <CardContent className="pt-5 flex justify-between items-center gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{s.name}</p>
                  <Badge variant="muted" className="mt-1">{s.scope}</Badge>
                </div>
                {confirmDelete === s.id ? (
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(s.id)}>
                      Oui
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>
                      Non
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setConfirmDelete(s.id)}
                    title="Supprimer"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
