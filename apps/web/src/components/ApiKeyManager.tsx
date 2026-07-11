"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Plus,
  Route,
  Shield,
  Sparkles,
} from "lucide-react";
import { api, ApiKey } from "@/lib/api";
import { API_SCOPES, API_SCOPE_PRESETS, DEFAULT_API_KEY_SCOPES } from "@/lib/api-docs";
import { EmptyState } from "@/components/EmptyState";
import { FormPanel } from "@/components/FormPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ApiKeyManager({
  onKeyCreated,
  onUseInExamples,
}: {
  onKeyCreated?: (key: string) => void;
  onUseInExamples?: () => void;
}) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([...DEFAULT_API_KEY_SCOPES]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    setKeys(await api.getApiKeys());
  }

  useEffect(() => {
    refresh()
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function toggleScope(scope: string) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  function applyPreset(presetScopes: readonly string[]) {
    setScopes([...presetScopes]);
  }

  async function handleCreate() {
    const res = await api.createApiKey({ name, scopes });
    setNewKey(res.key);
    onKeyCreated?.(res.key);
    setName("");
    setScopes([...DEFAULT_API_KEY_SCOPES]);
    setShowCreate(false);
    await refresh();
  }

  function copyKey() {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/50">
        <CardContent className="pt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-accent/10 p-2.5 shrink-0">
              <Shield className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium">Tokens d&apos;accès programmatique</p>
              <p className="text-sm text-muted-foreground mt-0.5 max-w-xl">
                Préfixe <code className="font-mono text-primary text-xs">rf_live_</code> —
                header <code className="font-mono text-xs">Authorization: Bearer …</code>
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4" />
            Nouvelle clé
          </Button>
        </CardContent>
      </Card>

      {newKey && (
        <Card className="border-success/30 bg-gradient-to-br from-success/10 to-success/5">
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-success" />
              <p className="text-sm font-medium text-success">
                Clé créée — copiez-la maintenant, elle ne sera plus affichée
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <code className="flex-1 min-w-[200px] rounded-lg bg-background border border-border px-3 py-2.5 text-xs font-mono break-all">
                {newKey}
              </code>
              <Button variant="outline" size="icon" onClick={copyKey} title="Copier la clé">
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
              {onUseInExamples && (
                <Button onClick={onUseInExamples}>
                  <Route className="h-4 w-4" />
                  Utiliser dans les exemples
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {showCreate && (
        <FormPanel
          title="Créer une clé API"
          description="Choisissez un profil ou sélectionnez les scopes manuellement"
          onClose={() => setShowCreate(false)}
        >
          <div className="space-y-5 max-w-2xl">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ci-pipeline"
              />
            </div>

            <div className="space-y-2">
              <Label>Profils rapides</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {API_SCOPE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.scopes)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-all hover:border-primary/40",
                      preset.scopes.every((s) => scopes.includes(s)) &&
                        preset.scopes.length === scopes.length
                        ? "border-primary/50 bg-primary/10"
                        : "border-border hover:bg-card-hover"
                    )}
                  >
                    <p className="text-sm font-medium">{preset.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Scopes</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {API_SCOPES.map((s) => (
                  <label
                    key={s.id}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border p-3 cursor-pointer transition-colors",
                      scopes.includes(s.id)
                        ? "border-primary/40 bg-primary/5"
                        : "border-border hover:bg-card-hover"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={scopes.includes(s.id)}
                      onChange={() => toggleScope(s.id)}
                      className="mt-0.5 accent-primary"
                    />
                    <span>
                      <span className="font-mono text-xs text-primary">{s.label}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">{s.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={handleCreate} disabled={!name.trim() || scopes.length === 0}>
              <KeyRound className="h-4 w-4" />
              Générer la clé
            </Button>
          </div>
        </FormPanel>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl border border-border bg-card/40 animate-pulse" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="Aucune clé API"
          description="Créez une clé pour automatiser vos jobs depuis un script, un pipeline CI/CD ou un cron externe."
          onAction={() => setShowCreate(true)}
          actionLabel="Créer ma première clé"
        />
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <Card key={k.id} hover>
              <CardContent className="pt-5 flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                    <KeyRound className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{k.name}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{k.prefix}…</p>
                  </div>
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
    </div>
  );
}
