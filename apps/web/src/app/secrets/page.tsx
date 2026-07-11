"use client";

import { useEffect, useState } from "react";
import { Plus, Shield } from "lucide-react";
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
            <Card key={s.id} hover>
              <CardContent className="pt-5 flex justify-between items-center">
                <p className="font-medium">{s.name}</p>
                <Badge variant="muted">{s.scope}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
