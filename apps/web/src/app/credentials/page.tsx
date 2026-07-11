"use client";

import { useEffect, useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, Credential } from "@/lib/api";

export default function CredentialsPage() {
  const [creds, setCreds] = useState<Credential[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [credType, setCredType] = useState("ssh");
  const [dataJson, setDataJson] = useState('{"username": "root", "private_key": ""}');
  const [error, setError] = useState("");

  async function refresh() {
    setCreds(await api.getCredentials());
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  async function handleCreate() {
    setError("");
    try {
      const data = JSON.parse(dataJson) as Record<string, unknown>;
      await api.createCredential({ name, credential_type: credType, data });
      setName("");
      setShowCreate(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Credentials"
        description="Identifiants chiffrés pour SSH, tokens et accès externes"
        action={
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4" />
            Nouveau credential
          </Button>
        }
      />

      {showCreate && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="pt-5 space-y-4 max-w-lg">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="prod-ssh" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={credType} onChange={(e) => setCredType(e.target.value)}>
                <option value="ssh">SSH</option>
                <option value="token">Token</option>
                <option value="basic">Basic auth</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Données (JSON)</Label>
              <Textarea
                value={dataJson}
                onChange={(e) => setDataJson(e.target.value)}
                className="font-mono text-xs min-h-[120px]"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleCreate} disabled={!name}>Créer</Button>
          </CardContent>
        </Card>
      )}

      {creds.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="Aucun credential"
          description="Stockez vos clés SSH et tokens de façon sécurisée."
          onAction={() => setShowCreate(true)}
          actionLabel="Ajouter un credential"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {creds.map((c) => (
            <Card key={c.id} hover>
              <CardContent className="pt-5 flex justify-between items-center">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <Badge variant="muted" className="mt-2">{c.credential_type}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
