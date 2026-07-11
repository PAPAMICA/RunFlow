"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  BookOpen,
  Boxes,
  ChevronsLeft,
  Cpu,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Play,
  Rows2,
  Rows3,
  Search,
  Server,
  Settings,
  Shield,
  Star,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { api, clearToken, User } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";

const mainNav = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/favorites", label: "Favoris", icon: Star },
  { href: "/jobs", label: "Jobs", icon: Boxes },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/runs", label: "Exécutions", icon: Play },
];

const automationNav = [
  { href: "/triggers", label: "Triggers", icon: Zap },
  { href: "/workers", label: "Workers", icon: Server },
  { href: "/inventories", label: "Inventaires", icon: Cpu },
];

const securityNav = [
  { href: "/api-docs", label: "Documentation API", icon: BookOpen },
  { href: "/secrets", label: "Secrets", icon: Shield },
  { href: "/credentials", label: "Credentials", icon: KeyRound },
];

function NavSection({
  title,
  items,
  pathname,
  collapsed,
  onNavigate,
}: {
  title: string;
  items: typeof mainNav;
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="mb-5">
      {!collapsed && (
        <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          {title}
        </p>
      )}
      <nav className="space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all relative",
                collapsed && "justify-center px-0",
                active
                  ? "bg-[var(--sidebar-active)] text-primary"
                  : "text-muted hover:text-foreground hover:bg-card/70"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-primary" />
              )}
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "opacity-70 group-hover:opacity-100")} />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SidebarContent({
  pathname,
  onLogout,
  collapsed,
  onToggleCollapse,
  onNavigate,
}: {
  pathname: string;
  onLogout: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className={cn("p-4 border-b border-border-subtle", collapsed && "px-3")}>
        <Link href="/dashboard" className="flex items-center gap-3 group" onClick={onNavigate}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 group-hover:glow-primary transition-shadow shrink-0">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          {!collapsed && (
            <div>
              <p className="font-bold text-[15px] tracking-tight">RunFlow</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Automation</p>
            </div>
          )}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none p-3">
        <NavSection title="Principal" items={mainNav} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
        <NavSection title="Automatisation" items={automationNav} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
        <NavSection title="Sécurité" items={securityNav} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
      </div>

      <div className="p-3 border-t border-border-subtle space-y-0.5">
        <Link
          href="/settings"
          onClick={onNavigate}
          title={collapsed ? "Paramètres" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
            collapsed && "justify-center px-0",
            pathname === "/settings"
              ? "bg-[var(--sidebar-active)] text-primary"
              : "text-muted hover:text-foreground hover:bg-card/70"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && "Paramètres"}
        </Link>
        <button
          onClick={onLogout}
          title={collapsed ? "Déconnexion" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-destructive hover:bg-destructive/10 transition-all",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && "Déconnexion"}
        </button>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={cn(
              "hidden lg:flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card/70 transition-all",
              collapsed && "justify-center px-0"
            )}
          >
            <ChevronsLeft className={cn("h-4 w-4 shrink-0 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && "Réduire"}
          </button>
        )}
      </div>
    </>
  );
}

function initials(email?: string) {
  if (!email) return "?";
  return email.slice(0, 2).toUpperCase();
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setCollapsed(localStorage.getItem("runflow.sidebar.collapsed") === "1");
    const savedDensity = localStorage.getItem("runflow.density");
    if (savedDensity === "compact") setDensity("compact");
    api.getMe().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("runflow.sidebar.collapsed", next ? "1" : "0");
      return next;
    });
  }

  function toggleDensity() {
    setDensity((d) => {
      const next = d === "compact" ? "comfortable" : "compact";
      localStorage.setItem("runflow.density", next);
      return next;
    });
  }

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex">
      <aside
        className={cn(
          "hidden lg:flex shrink-0 border-r border-border bg-sidebar flex-col transition-all duration-200",
          collapsed ? "w-[68px]" : "w-64"
        )}
      >
        <SidebarContent
          pathname={pathname}
          onLogout={logout}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] h-full bg-sidebar border-r border-border flex flex-col animate-slide-up">
            <button
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-card text-muted-foreground"
              onClick={() => setMobileOpen(false)}
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent pathname={pathname} onLogout={logout} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex items-center gap-3 h-[var(--topbar-h)] px-4 border-b border-border bg-[var(--surface-elevated)] backdrop-blur-xl">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-card border border-transparent hover:border-border"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            onClick={() => setPaletteOpen(true)}
            className="group flex items-center gap-2.5 h-9 flex-1 max-w-md rounded-lg border border-border bg-surface-2/50 px-3 text-sm text-muted-foreground hover:border-border-strong transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Rechercher…</span>
            <span className="hidden sm:flex items-center gap-0.5">
              <kbd className="kbd">⌘</kbd>
              <kbd className="kbd">K</kbd>
            </span>
          </button>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={toggleDensity}
              title={density === "compact" ? "Affichage confortable" : "Affichage compact"}
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-card border border-transparent hover:border-border transition-colors"
              aria-label="Densité d'affichage"
            >
              {density === "compact" ? <Rows2 className="h-4 w-4" /> : <Rows3 className="h-4 w-4" />}
            </button>
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
              Opérationnel
            </span>
            <div className="flex items-center gap-2 pl-3 border-l border-border">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 to-accent/25 text-xs font-semibold text-foreground ring-1 ring-border">
                {initials(user?.email)}
              </div>
              <span className="hidden sm:block text-sm max-w-[140px] truncate text-muted">
                {user?.email ?? "…"}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div key={pathname} className="mx-auto max-w-7xl p-5 sm:p-6 lg:p-8 animate-slide-up">
            {children}
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
