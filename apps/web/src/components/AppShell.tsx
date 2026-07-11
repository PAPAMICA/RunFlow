"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Boxes,
  Cpu,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Play,
  Server,
  Settings,
  Shield,
  Sparkles,
  Workflow,
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
  { href: "/secrets", label: "Secrets", icon: Shield },
  { href: "/credentials", label: "Credentials", icon: KeyRound },
  { href: "/api-keys", label: "Clés API", icon: Sparkles },
];

function NavSection({
  title,
  items,
  pathname,
}: {
  title: string;
  items: typeof mainNav;
  pathname: string;
}) {
  return (
    <div className="mb-6">
      <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
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
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-[var(--sidebar-active)] text-primary border border-primary/20"
                  : "text-muted hover:text-foreground hover:bg-card"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="p-5 border-b border-border-subtle">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 border border-primary/25 group-hover:glow-primary transition-shadow">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-base tracking-tight">RunFlow</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Automation</p>
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <NavSection title="Principal" items={mainNav} pathname={pathname} />
          <NavSection title="Automatisation" items={automationNav} pathname={pathname} />
          <NavSection title="Sécurité" items={securityNav} pathname={pathname} />
        </div>

        <div className="p-4 border-t border-border-subtle space-y-1">
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              pathname === "/settings"
                ? "bg-[var(--sidebar-active)] text-primary"
                : "text-muted hover:text-foreground hover:bg-card"
            )}
          >
            <Settings className="h-4 w-4" />
            Paramètres
          </Link>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl p-6 lg:p-8 animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
