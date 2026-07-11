"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Globe,
  KeyRound,
  Link2,
  Play,
  Route,
  Terminal,
  User,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ApiKeyManager } from "@/components/ApiKeyManager";
import { ApiRouteExplorer } from "@/components/ApiRouteExplorer";
import { PageHeader } from "@/components/PageHeader";
import { Tabs } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { API_ROUTE_GROUPS, getApiBaseUrl } from "@/lib/api-docs";
import { getToken } from "@/lib/api";
import { cn } from "@/lib/utils";

type DocTab = "intro" | "keys" | "routes";

const AUTH_METHODS = [
  {
    icon: User,
    title: "Interface web (JWT)",
    hint: "POST /api/v1/auth/login → token stocké côté client",
    example: "Authorization: Bearer eyJhbG…",
    color: "text-primary bg-primary/10",
  },
  {
    icon: KeyRound,
    title: "Scripts & CI/CD (clé API)",
    hint: "Préfixe rf_live_ — scopes limités par clé",
    example: "Authorization: Bearer rf_live_…",
    color: "text-accent bg-accent/10",
  },
  {
    icon: Bot,
    title: "Worker (agent)",
    hint: "Token rf_wkr_… obtenu via /worker/register",
    example: "Authorization: Bearer rf_wkr_…",
    color: "text-success bg-success/10",
  },
] as const;

const QUICK_LINKS = [
  {
    tab: "keys" as const,
    icon: KeyRound,
    title: "Créer une clé API",
    description: "Générez un token pour vos scripts et pipelines",
    color: "from-accent/20 to-accent/5",
  },
  {
    tab: "routes" as const,
    icon: Route,
    title: "Explorer les routes",
    description: `${API_ROUTE_GROUPS.reduce((n, g) => n + g.routes.length, 0)} endpoints documentés`,
    color: "from-success/20 to-success/5",
  },
] as const;

function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex gap-2">
      <code className="flex-1 rounded-lg bg-black/30 border border-border px-4 py-3 text-sm font-mono break-all">
        {value}
      </code>
      <Button variant="outline" size="icon" onClick={copy} title={label ?? "Copier"}>
        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export default function ApiDocsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<DocTab>("intro");
  const [demoToken, setDemoToken] = useState("");

  const setTabWithUrl = useCallback(
    (next: DocTab) => {
      setTab(next);
      router.replace(`/api-docs?tab=${next}`, { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "keys" || t === "routes" || t === "intro") setTab(t);
  }, [searchParams]);

  useEffect(() => {
    setDemoToken(getToken() || "");
  }, []);

  const baseUrl = getApiBaseUrl();
  const routeCount = API_ROUTE_GROUPS.reduce((n, g) => n + g.routes.length, 0);

  return (
    <AppShell>
      <PageHeader
        title="Documentation API"
        description="Authentification, clés d'accès et référence des endpoints REST"
        breadcrumb={[{ label: "Documentation API" }]}
        action={
          <a href={`${baseUrl}/docs`} target="_blank" rel="noreferrer">
            <Button variant="outline">
              <ExternalLink className="h-4 w-4" />
              Swagger UI
            </Button>
          </a>
        }
      />

      <div className="mb-6 border-b border-border pb-2">
        <Tabs
          items={[
            { key: "intro", label: "Introduction", icon: BookOpen },
            { key: "keys", label: "Clés API", icon: KeyRound },
            { key: "routes", label: "Référence", icon: Route, badge: routeCount },
          ]}
          active={tab}
          onChange={(k) => setTabWithUrl(k as DocTab)}
        />
      </div>

      {tab === "intro" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <a
              href={`${baseUrl}/docs`}
              target="_blank"
              rel="noreferrer"
              className="group rounded-xl border border-border bg-gradient-to-br from-primary/15 to-primary/5 p-5 hover:border-primary/30 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-lg bg-primary/15 p-2.5">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="font-semibold mt-4">Swagger interactif</h3>
              <p className="text-sm text-muted-foreground mt-1">Tester les endpoints en direct</p>
            </a>

            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.tab}
                  type="button"
                  onClick={() => setTabWithUrl(link.tab)}
                  className={cn(
                    "group text-left rounded-xl border border-border bg-gradient-to-br p-5",
                    "hover:border-primary/30 transition-all",
                    link.color
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="rounded-lg bg-background/50 p-2.5 ring-1 ring-border/50">
                      <Icon className="h-5 w-5 text-foreground" />
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h3 className="font-semibold mt-4">{link.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{link.description}</p>
                </button>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glow-subtle">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <Link2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">URL de base</h3>
                    <p className="text-xs text-muted-foreground">Préfixe /api/v1 pour les routes métier</p>
                  </div>
                </div>
                <CopyField value={baseUrl} label="Copier l'URL de base" />
              </CardContent>
            </Card>

            <Card className="glow-subtle">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-accent/10 p-2.5">
                    <KeyRound className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Authentification</h3>
                    <p className="text-xs text-muted-foreground">Trois modes selon le contexte d&apos;appel</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {AUTH_METHODS.map((m) => {
                    const Icon = m.icon;
                    return (
                      <div
                        key={m.title}
                        className="rounded-lg border border-border p-3.5 hover:bg-card-hover/40 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn("rounded-md p-2 shrink-0", m.color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">{m.title}</p>
                            <p className="text-muted-foreground text-xs mt-0.5">{m.hint}</p>
                            <pre className="text-[11px] font-mono bg-black/30 rounded-md px-2 py-1.5 mt-2 overflow-x-auto">
                              {m.example}
                            </pre>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-success/20 bg-gradient-to-br from-success/5 to-transparent">
              <CardContent className="pt-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-success/10 p-2.5">
                    <Terminal className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Démarrage rapide — lancer un job</h3>
                    <p className="text-xs text-muted-foreground">En 2 étapes avec une clé API</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      1
                    </span>
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        <KeyRound className="h-3.5 w-3.5 text-accent" />
                        Créer une clé API
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Scopes <code className="font-mono">job:run</code> +{" "}
                        <code className="font-mono">run:read</code>
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setTabWithUrl("keys")}
                      >
                        Aller aux clés API
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/15 text-xs font-bold text-success">
                      2
                    </span>
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Play className="h-3.5 w-3.5 text-success" />
                        Lancer et suivre
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        POST run puis flux SSE des logs
                      </p>
                    </div>
                  </div>
                </div>

                <pre className="text-xs font-mono bg-black/40 rounded-xl p-4 overflow-x-auto leading-relaxed border border-border/50">{`curl -s -X POST \\
  -H "Authorization: Bearer rf_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"arguments": {"cal_only": true}}' \\
  "${baseUrl}/api/v1/jobs/mon-job/run?wait=true"

curl -N -H "Authorization: Bearer rf_live_…" \\
  "${baseUrl}/api/v1/runs/01KX…/logs/stream"`}</pre>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "keys" && (
        <ApiKeyManager
          onKeyCreated={(key) => {
            setDemoToken(key);
          }}
          onUseInExamples={() => setTabWithUrl("routes")}
        />
      )}

      {tab === "routes" && (
        <ApiRouteExplorer
          demoToken={demoToken}
          onTokenChange={setDemoToken}
          onGoToKeys={() => setTabWithUrl("keys")}
        />
      )}
    </AppShell>
  );
}
