"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  BookOpen,
  Boxes,
  Cpu,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Play,
  Server,
  Settings,
  Shield,
  Sparkles,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { clearToken } from "@/lib/api";
import { cn } from "@/lib/utils";

const mainNav = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
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
  onNavigate,
}: {
  title: string;
  items: typeof mainNav;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="mb-5">
      <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
        {title}
      </p>
      <nav className="space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all relative",
                active
                  ? "bg-[var(--sidebar-active)] text-primary"
                  : "text-muted hover:text-foreground hover:bg-card/60"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-primary" />
              )}
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "opacity-70 group-hover:opacity-100")} />
              {item.label}
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
  onNavigate,
}: {
  pathname: string;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="p-5 border-b border-border-subtle">
        <Link href="/dashboard" className="flex items-center gap-3 group" onClick={onNavigate}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 group-hover:glow-primary transition-shadow">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-base tracking-tight">RunFlow</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Automation</p>
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <NavSection title="Principal" items={mainNav} pathname={pathname} onNavigate={onNavigate} />
        <NavSection title="Automatisation" items={automationNav} pathname={pathname} onNavigate={onNavigate} />
        <NavSection title="Sécurité" items={securityNav} pathname={pathname} onNavigate={onNavigate} />
      </div>

      <div className="p-4 border-t border-border-subtle space-y-0.5">
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
            pathname === "/settings"
              ? "bg-[var(--sidebar-active)] text-primary"
              : "text-muted hover:text-foreground hover:bg-card/60"
          )}
        >
          <Settings className="h-4 w-4" />
          Paramètres
        </Link>
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:text-destructive hover:bg-destructive/10 transition-all"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </button>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-border bg-sidebar flex-col">
        <SidebarContent pathname={pathname} onLogout={logout} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] h-full bg-sidebar border-r border-border flex flex-col animate-slide-up">
            <button
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-card text-muted-foreground"
              onClick={() => setMobileOpen(false)}
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent
              pathname={pathname}
              onLogout={logout}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 py-3 border-b border-border bg-[var(--surface-elevated)] backdrop-blur-xl">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-card border border-border"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-bold">RunFlow</span>
          </Link>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl p-5 sm:p-6 lg:p-8 page-enter">{children}</div>
        </main>
      </div>
    </div>
  );
}
