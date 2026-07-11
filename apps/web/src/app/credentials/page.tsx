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

const CRED_TEMPLATES: Record<string, string> = {
  git: '{"username": "x-access-token", "token": ""}',
  ssh: '{"username": "root", "private_key": ""}',
  token: '{"token": ""}',
  basic: '{"username": "", "password": ""}',
};

export default function CredentialsPage() {
  const [creds, setCreds] = useState<Credential[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [credType, setCredType] = useState("git");
  const [gitUsername, setGitUsername] = useState("x-access-token");
  const [gitToken, setGitToken] = useState("");
  const [dataJson, setDataJson] = useState(CRED_TEMPLATES.git);
  const [error, setError] = useState("");

  async function refresh() {
    setCreds(await api.getCredentials());
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  function onTypeChange(type: string) {
    setCredType(type);
    setDataJson(CRED_TEMPLATES[type] ?? "{}");
  }

  async function handleCreate() {
    setError("");
    try {
      let data: Record<string, unknown>;
      if (credType === "git") {
        if (!gitToken.trim()) {
          setError("Le token Git est requis");
          return;
        }
        data = { username: gitUsername.trim() || "x-access-token", token: gitToken.trim() };
      } else {
        data = JSON.parse(dataJson) as Record<string, unknown>;
      }
      await api.createCredential({ name, credential_type: credType, data });
      setName("");
      setGitToken("");
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
        description="Identifiants chiffrés pour Git, SSH, tokens et accès externes"
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
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="github-papamica" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={credType} onChange={(e) => onTypeChange(e.target.value)}>
                <option value="git">Git (PAT)</option>
                <option value="ssh">SSH</option>
                <option value="token">Token</option>
                <option value="basic">Basic auth</option>
              </Select>
            </div>

            {credType === "git" ? (
              <>
                <div className="space-y-2">
                  <Label>Utilisateur Git</Label>
                  <Input
                    value={gitUsername}
                    onChange={(e) => setGitUsername(e.target.value)}
                    placeholder="x-access-token"
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">GitHub : x-access-token · GitLab : oauth2</p>
                </div>
                <div className="space-y-2">
                  <Label>Token / PAT</Label>
                  <Input
                    type="password"
                    value={gitToken}
                    onChange={(e) => setGitToken(e.target.value)}
                    placeholder="ghp_…"
                    autoComplete="off"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>Données (JSON)</Label>
                <Textarea
                  value={dataJson}
                  onChange={(e) => setDataJson(e.target.value)}
                  className="font-mono text-xs min-h-[120px]"
                />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleCreate} disabled={!name.trim()}>
              Créer
            </Button>
          </CardContent>
        </Card>
      )}

      {creds.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="Aucun credential"
          description="Ajoutez un credential Git (PAT) pour cloner des dépôts privés."
          onAction={() => setShowCreate(true)}
          actionLabel="Ajouter un credential"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {creds.map((c) => (
            <Card key={c.id}>
              <CardContent className="pt-5">
                <p className="font-medium">{c.name}</p>
                <Badge variant="muted" className="mt-2">{c.credential_type}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
