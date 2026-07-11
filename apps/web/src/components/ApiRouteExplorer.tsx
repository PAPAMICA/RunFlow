"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Bot,
  Boxes,
  Check,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  LayoutDashboard,
  LogIn,
  Play,
  Route,
  SearchX,
  Server,
  Shield,
  User,
  Webhook,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  ApiRouteDoc,
  API_ROUTE_GROUPS,
  buildCurlExample,
  getApiBaseUrl,
} from "@/lib/api-docs";
import { EmptyState } from "@/components/EmptyState";
import { SearchInput } from "@/components/SearchInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-success/15 text-success border-success/30",
  POST: "bg-primary/15 text-primary border-primary/30",
  PATCH: "bg-warning/15 text-warning border-warning/30",
  PUT: "bg-warning/15 text-warning border-warning/30",
  DELETE: "bg-destructive/15 text-destructive border-destructive/30",
};

const GROUP_ICONS: Record<string, LucideIcon> = {
  auth: LogIn,
  jobs: Boxes,
  runs: Play,
  workflows: Workflow,
  automation: Zap,
  secrets: Shield,
  "api-keys": KeyRound,
  dashboard: LayoutDashboard,
  worker: Server,
  system: Activity,
};

const AUTH_META: Record<
  ApiRouteDoc["auth"],
  { label: string; icon: LucideIcon; className: string }
> = {
  public: { label: "Public", icon: Globe, className: "text-muted-foreground" },
  user: { label: "JWT", icon: User, className: "text-primary" },
  api_key: { label: "Clé API", icon: KeyRound, className: "text-accent" },
  worker: { label: "Worker", icon: Bot, className: "text-success" },
  hook: { label: "Webhook", icon: Webhook, className: "text-warning" },
};

type AuthFilter = "all" | ApiRouteDoc["auth"];

function RouteCard({ route, token }: { route: ApiRouteDoc; token: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const baseUrl = getApiBaseUrl();
  const curl = buildCurlExample(route, token, baseUrl);
  const auth = AUTH_META[route.auth];

  function copyCurl() {
    navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border-subtle bg-card/40 overflow-hidden transition-colors",
        expanded && "border-primary/20 bg-card/60"
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-card-hover/50 transition-colors"
      >
        <span
          className={cn(
            "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold font-mono",
            METHOD_STYLES[route.method]
          )}
        >
          {route.method}
        </span>
        <code className="text-xs font-mono text-foreground/90 break-all flex-1 min-w-0">
          {route.path}
        </code>
        <Badge variant="muted" className="shrink-0 text-[10px] gap-1">
          <auth.icon className={cn("h-3 w-3", auth.className)} />
          {auth.label}
        </Badge>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border-subtle pt-3">
          <p className="text-sm text-muted-foreground">{route.summary}</p>
          {route.permission && (
            <p className="text-xs flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Permission :</span>
              <code className="font-mono text-primary">{route.permission}</code>
            </p>
          )}
          {route.query && (
            <p className="text-xs font-mono text-muted-foreground">Query : {route.query}</p>
          )}
          {route.body && (
            <pre className="text-xs font-mono bg-black/30 rounded-lg p-3 overflow-x-auto">{route.body}</pre>
          )}
          {route.response && (
            <p className="text-xs">
              <span className="text-muted-foreground">Réponse : </span>
              <code className="font-mono">{route.response}</code>
            </p>
          )}
          <div className="relative">
            <pre className="text-[11px] font-mono bg-black/40 rounded-lg p-3 pr-24 overflow-x-auto whitespace-pre-wrap">
              {curl}
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2 h-7"
              onClick={copyCurl}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copié" : "curl"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ApiRouteExplorer({
  demoToken,
  onTokenChange,
  onGoToKeys,
}: {
  demoToken: string;
  onTokenChange?: (token: string) => void;
  onGoToKeys?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [authFilter, setAuthFilter] = useState<AuthFilter>("all");
  const [showToken, setShowToken] = useState(false);

  const effectiveToken = demoToken || "rf_live_VOTRE_CLE";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return API_ROUTE_GROUPS.map((g) => ({
      ...g,
      routes: g.routes.filter((r) => {
        if (group && g.id !== group) return false;
        if (authFilter !== "all" && r.auth !== authFilter) return false;
        if (!q) return true;
        return (
          r.path.toLowerCase().includes(q) ||
          r.summary.toLowerCase().includes(q) ||
          r.method.toLowerCase().includes(q) ||
          (r.permission?.toLowerCase().includes(q) ?? false)
        );
      }),
    })).filter((g) => g.routes.length > 0);
  }, [search, group, authFilter]);

  const totalRoutes = filtered.reduce((n, g) => n + g.routes.length, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 space-y-2">
            <Label className="flex items-center gap-2 text-xs">
              <KeyRound className="h-3.5 w-3.5 text-accent" />
              Token pour les exemples curl
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1 max-w-lg">
                <Input
                  type={showToken ? "text" : "password"}
                  value={demoToken}
                  onChange={(e) => onTokenChange?.(e.target.value)}
                  placeholder="rf_live_… ou JWT de session"
                  className="font-mono text-xs pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {onGoToKeys && (
                <Button variant="outline" onClick={onGoToKeys}>
                  <KeyRound className="h-4 w-4" />
                  Créer une clé
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {demoToken
                ? "Token actif — injecté dans tous les exemples curl"
                : "Aucun token — les exemples utilisent un placeholder"}
            </p>
          </div>
          <div className="flex items-end">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Rechercher une route…"
              className="w-full lg:w-72"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Catégories</p>
          <div className="flex flex-wrap gap-1.5 p-1 rounded-lg bg-card/60 border border-border">
            <button
              type="button"
              onClick={() => setGroup(null)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                !group ? "bg-primary/15 text-primary shadow-sm" : "text-muted-foreground hover:bg-card-hover"
              )}
            >
              <Route className="h-3 w-3" />
              Toutes
            </button>
            {API_ROUTE_GROUPS.map((g) => {
              const Icon = GROUP_ICONS[g.id] ?? Route;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroup(g.id === group ? null : g.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
                    group === g.id
                      ? "bg-primary/15 text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-card-hover"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {g.title}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Authentification</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setAuthFilter("all")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                authFilter === "all"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-transparent text-muted-foreground hover:bg-card"
              )}
            >
              Tous
            </button>
            {(Object.keys(AUTH_META) as ApiRouteDoc["auth"][]).map((key) => {
              const meta = AUTH_META[key];
              const Icon = meta.icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAuthFilter(authFilter === key ? "all" : key)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5",
                    authFilter === key
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground hover:bg-card"
                  )}
                >
                  <Icon className={cn("h-3 w-3", meta.className)} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {totalRoutes === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Aucune route trouvée"
          description="Modifiez vos filtres ou votre recherche pour afficher les endpoints disponibles."
          onAction={() => {
            setSearch("");
            setGroup(null);
            setAuthFilter("all");
          }}
          actionLabel="Réinitialiser les filtres"
        />
      ) : (
        <div className="space-y-8">
          <p className="text-sm text-muted-foreground">
            {totalRoutes} route{totalRoutes > 1 ? "s" : ""} affichée{totalRoutes > 1 ? "s" : ""}
          </p>
          {filtered.map((g) => {
            const GroupIcon = GROUP_ICONS[g.id] ?? Route;
            return (
              <section key={g.id} id={`api-group-${g.id}`}>
                <div className="mb-3 flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                    <GroupIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold flex items-center gap-2">
                      {g.title}
                      <Badge variant="muted" className="text-[10px]">
                        {g.routes.length}
                      </Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground">{g.description}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {g.routes.map((r) => (
                    <RouteCard
                      key={`${r.method}-${r.path}`}
                      route={r}
                      token={effectiveToken}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
