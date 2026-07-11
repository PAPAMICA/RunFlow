"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Cpu,
  KeyRound,
  LayoutDashboard,
  Play,
  Search,
  Server,
  Settings,
  Shield,
  Star,
  Workflow,
  Zap,
  BookOpen,
  CornerDownLeft,
} from "lucide-react";
import { api, Job } from "@/lib/api";
import { cn } from "@/lib/utils";

type Command = {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Play;
  action: () => void;
  keywords?: string;
};

const NAV: { label: string; href: string; icon: typeof Play }[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Favoris", href: "/favorites", icon: Star },
  { label: "Jobs", href: "/jobs", icon: Boxes },
  { label: "Workflows", href: "/workflows", icon: Workflow },
  { label: "Exécutions", href: "/runs", icon: Play },
  { label: "Triggers", href: "/triggers", icon: Zap },
  { label: "Workers", href: "/workers", icon: Server },
  { label: "Inventaires", href: "/inventories", icon: Cpu },
  { label: "Documentation API", href: "/api-docs", icon: BookOpen },
  { label: "Secrets", href: "/secrets", icon: Shield },
  { label: "Credentials", href: "/credentials", icon: KeyRound },
  { label: "Paramètres", href: "/settings", icon: Settings },
];

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [jobs, setJobs] = useState<Job[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
      if (jobs.length === 0) {
        api.getJobs().then(setJobs).catch(() => {});
      }
    }
  }, [open, jobs.length]);

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = NAV.map((n) => ({
      id: `nav:${n.href}`,
      label: n.label,
      hint: "Aller à",
      icon: n.icon,
      action: () => router.push(n.href),
    }));
    const jobCmds: Command[] = jobs.flatMap((j) => [
      {
        id: `job:${j.id}`,
        label: j.name,
        hint: "Ouvrir le job",
        icon: Boxes,
        keywords: j.slug,
        action: () => router.push(`/jobs/${j.id}`),
      },
      {
        id: `run:${j.id}`,
        label: `Lancer « ${j.name} »`,
        hint: "Exécuter",
        icon: Play,
        keywords: j.slug,
        action: () => router.push(`/jobs/${j.id}?tab=run`),
      },
    ]);
    return [...nav, ...jobCmds];
  }, [jobs, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 8);
    return commands
      .filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.keywords?.toLowerCase().includes(q) ||
          c.hint?.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [commands, query]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[active];
        if (cmd) {
          cmd.action();
          onClose();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, active, onClose]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl rounded-2xl border border-border-strong bg-elevated shadow-elevated overflow-hidden animate-scale-in">
        <div className="flex items-center gap-3 px-4 border-b border-border-subtle">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un job, une page, une action…"
            className="flex-1 bg-transparent h-12 text-sm outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="kbd">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun résultat</p>
          ) : (
            filtered.map((cmd, i) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    i === active ? "bg-primary/12 text-foreground" : "text-muted hover:bg-card"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", i === active ? "text-primary" : "text-muted-foreground")} />
                  <span className="flex-1 text-sm truncate">{cmd.label}</span>
                  {cmd.hint && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{cmd.hint}</span>
                  )}
                  {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
