"use client";

import Link from "next/link";
import { KeyRound, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Credential } from "@/lib/api";
import { cn } from "@/lib/utils";

export type GitAuthMode = "token" | "credential";

function guessUsername(url: string): string {
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (host.includes("github.com")) return "x-access-token";
  if (host.includes("gitlab")) return "oauth2";
  if (host.includes("bitbucket.org")) return "x-token-auth";
  return "git";
}

export interface GitAuthSectionProps {
  repoUrl: string;
  mode: GitAuthMode;
  onModeChange: (mode: GitAuthMode) => void;
  username: string;
  onUsernameChange: (value: string) => void;
  token: string;
  onTokenChange: (value: string) => void;
  credentialId: string;
  onCredentialIdChange: (value: string) => void;
  credentials: Credential[];
}

export function GitAuthSection({
  repoUrl,
  mode,
  onModeChange,
  username,
  onUsernameChange,
  token,
  onTokenChange,
  credentialId,
  onCredentialIdChange,
  credentials,
}: GitAuthSectionProps) {
  const gitCredentials = credentials.filter((c) => c.credential_type === "git" || c.credential_type === "token");
  const suggestedUser = guessUsername(repoUrl);

  return (
    <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Lock className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Authentification Git (dépôt privé)</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            GitHub : Personal Access Token avec scope <code className="text-primary">repo</code>
          </p>
        </div>
      </div>

      <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
        <button
          type="button"
          onClick={() => onModeChange("token")}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            mode === "token" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Token direct
        </button>
        <button
          type="button"
          onClick={() => onModeChange("credential")}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            mode === "credential" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Credential sauvegardé
        </button>
      </div>

      {mode === "token" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="git-username">Utilisateur Git</Label>
            <Input
              id="git-username"
              value={username || suggestedUser}
              onChange={(e) => onUsernameChange(e.target.value)}
              placeholder={suggestedUser}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              GitHub : laissez <code>x-access-token</code>
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="git-token">Token / PAT *</Label>
            <Input
              id="git-token"
              type="password"
              value={token}
              onChange={(e) => onTokenChange(e.target.value)}
              placeholder="ghp_… ou glpat-…"
              autoComplete="off"
              required
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="git-credential">Credential Git</Label>
          <Select
            id="git-credential"
            value={credentialId}
            onChange={(e) => onCredentialIdChange(e.target.value)}
            required
          >
            <option value="">Sélectionner un credential…</option>
            {gitCredentials.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.credential_type})
              </option>
            ))}
          </Select>
          {gitCredentials.length === 0 && (
            <p className="text-xs text-muted-foreground">
              <Link href="/credentials" className="text-primary hover:underline inline-flex items-center gap-1">
                <KeyRound className="h-3 w-3" />
                Créer un credential Git
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function buildGitAuthPayload(
  mode: GitAuthMode,
  username: string,
  token: string,
  credentialId: string,
  repoUrl: string,
): { username?: string; access_token?: string; credential_id?: string } {
  if (mode === "credential" && credentialId) {
    return { credential_id: credentialId };
  }
  if (mode === "token" && token.trim()) {
    return {
      username: username.trim() || guessUsername(repoUrl),
      access_token: token.trim(),
    };
  }
  return {};
}

export function validateGitAuth(
  mode: GitAuthMode,
  token: string,
  credentialId: string,
): string | null {
  if (mode === "token" && !token.trim()) {
    return "Un token Git est requis pour un dépôt privé";
  }
  if (mode === "credential" && !credentialId) {
    return "Sélectionnez un credential Git";
  }
  return null;
}
