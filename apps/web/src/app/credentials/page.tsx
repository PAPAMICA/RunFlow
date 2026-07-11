"use client";

import { useEffect, useState } from "react";
import { GitBranch, KeyRound, Lock, Plus, Terminal, Trash2, User } from "lucide-react";
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
import { cn } from "@/lib/utils";

type CredType = "git" | "ssh" | "token" | "basic";

const CRED_META: Record<CredType, { label: string; icon: typeof KeyRound; hint: string }> = {
  git: { label: "Git (PAT)", icon: GitBranch, hint: "Clone de dépôts privés" },
  ssh: { label: "SSH", icon: Terminal, hint: "Runners SSH & Ansible" },
  token: { label: "Token / API", icon: KeyRound, hint: "Jeton d'API générique" },
  basic: { label: "Basic auth", icon: User, hint: "Utilisateur + mot de passe" },
};

const TYPE_ICON: Record<string, typeof KeyRound> = {
  git: GitBranch,
  ssh: Terminal,
  token: KeyRound,
  basic: User,
};

export default function CredentialsPage() {
  const [creds, setCreds] = useState<Credential[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [credType, setCredType] = useState<CredType>("git");

  // Typed fields (shared across types).
  const [username, setUsername] = useState("x-access-token");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [sshAuth, setSshAuth] = useState<"key" | "password">("key");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function refresh() {
    setCreds(await api.getCredentials());
  }

  useEffect(() => {
    refresh().catch(console.error);
  }, []);

  function resetForm() {
    setName("");
    setUsername("x-access-token");
    setToken("");
    setPassword("");
    setPrivateKey("");
    setPassphrase("");
    setSshAuth("key");
    setError("");
  }

  function onTypeChange(type: CredType) {
    setCredType(type);
    setError("");
    if (type === "git") setUsername("x-access-token");
    else if (username === "x-access-token") setUsername("root");
  }

  function buildData(): Record<string, unknown> | null {
    switch (credType) {
      case "git":
        if (!token.trim()) {
          setError("Le token Git est requis.");
          return null;
        }
        return { username: username.trim() || "x-access-token", token: token.trim() };
      case "ssh":
        if (sshAuth === "key") {
          if (!privateKey.trim()) {
            setError("La clé privée SSH est requise.");
            return null;
          }
          return {
            username: username.trim() || "root",
            private_key: privateKey,
            ...(passphrase ? { passphrase } : {}),
          };
        }
        if (!password) {
          setError("Le mot de passe est requis.");
          return null;
        }
        return { username: username.trim() || "root", password };
      case "token":
        if (!token.trim()) {
          setError("Le token est requis.");
          return null;
        }
        return { token: token.trim() };
      case "basic":
        if (!username.trim() || !password) {
          setError("Utilisateur et mot de passe requis.");
          return null;
        }
        return { username: username.trim(), password };
      default:
        return {};
    }
  }

  async function handleCreate() {
    setError("");
    const data = buildData();
    if (!data) return;
    setSaving(true);
    try {
      await api.createCredential({ name: name.trim(), credential_type: credType, data });
      resetForm();
      setShowCreate(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteCredential(id);
      setConfirmDelete(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Credentials"
        description="Identifiants chiffrés (AES-256-GCM) pour Git, SSH, tokens et accès externes"
        action={
          <Button
            onClick={() => {
              setShowCreate((s) => !s);
              resetForm();
            }}
          >
            <Plus className="h-4 w-4" />
            Nouveau credential
          </Button>
        }
      />

      {showCreate && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="pt-5 space-y-5 max-w-xl">
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(Object.keys(CRED_META) as CredType[]).map((t) => {
                  const meta = CRED_META[t];
                  const Icon = meta.icon;
                  const active = credType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onTypeChange(t)}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all",
                        active
                          ? "border-primary/50 bg-primary/10 ring-1 ring-primary/30"
                          : "border-border hover:bg-card-hover"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-sm font-medium">{meta.label}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">{meta.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={credType === "ssh" ? "prod-ssh" : "github-papamica"}
              />
            </div>

            {credType === "git" && (
              <>
                <div className="space-y-2">
                  <Label>Utilisateur Git</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="x-access-token"
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">GitHub : x-access-token · GitLab : oauth2</p>
                </div>
                <div className="space-y-2">
                  <Label>Token / PAT</Label>
                  <Input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_…"
                    autoComplete="off"
                  />
                </div>
              </>
            )}

            {credType === "ssh" && (
              <>
                <div className="space-y-2">
                  <Label>Utilisateur SSH</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="root"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Méthode d&apos;authentification</Label>
                  <div className="flex gap-2">
                    {(["key", "password"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSshAuth(m)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-all",
                          sshAuth === m
                            ? "border-primary/50 bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:bg-card-hover"
                        )}
                      >
                        {m === "key" ? <KeyRound className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                        {m === "key" ? "Clé privée" : "Mot de passe"}
                      </button>
                    ))}
                  </div>
                </div>

                {sshAuth === "key" ? (
                  <>
                    <div className="space-y-2">
                      <Label>Clé privée SSH</Label>
                      <Textarea
                        value={privateKey}
                        onChange={(e) => setPrivateKey(e.target.value)}
                        placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n…\n-----END OPENSSH PRIVATE KEY-----"}
                        className="font-mono text-xs min-h-[160px]"
                        spellCheck={false}
                        autoComplete="off"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Collez le contenu complet du fichier (ex. <code>~/.ssh/id_ed25519</code>). Jamais réaffiché après enregistrement.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Passphrase (optionnel)</Label>
                      <Input
                        type="password"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label>Mot de passe</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="off"
                    />
                    <p className="text-[11px] text-muted-foreground">Utilise sshpass côté runner.</p>
                  </div>
                )}
              </>
            )}

            {credType === "token" && (
              <div className="space-y-2">
                <Label>Token</Label>
                <Input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="sk-…"
                  autoComplete="off"
                />
              </div>
            )}

            {credType === "basic" && (
              <>
                <div className="space-y-2">
                  <Label>Utilisateur</Label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Mot de passe</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex items-center gap-2">
              <Button onClick={handleCreate} disabled={!name.trim() || saving}>
                {saving ? "Enregistrement…" : "Créer"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
              >
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {creds.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="Aucun credential"
          description="Ajoutez un credential Git (PAT) ou SSH (clé/mot de passe) pour vos jobs."
          onAction={() => setShowCreate(true)}
          actionLabel="Ajouter un credential"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {creds.map((c) => {
            const Icon = TYPE_ICON[c.credential_type] ?? KeyRound;
            return (
              <Card key={c.id}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        <Badge variant="muted" className="mt-1">{c.credential_type}</Badge>
                      </div>
                    </div>
                    {confirmDelete === c.id ? (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(c.id)}>
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
                        onClick={() => setConfirmDelete(c.id)}
                        title="Supprimer"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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
