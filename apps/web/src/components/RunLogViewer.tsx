"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Bug, Copy, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface RunLogEntry {
  sequence: number;
  stream: string;
  message: string;
  timestamp: string;
}

const STREAM_STYLES: Record<string, string> = {
  stderr: "text-red-400",
  system: "text-amber-400",
  stdout: "text-cyan-300/90",
  debug: "text-violet-300",
};

const BASE_FILTERS = [
  { id: "all", label: "Tous" },
  { id: "normal", label: "Exécution" },
  { id: "stdout", label: "stdout" },
  { id: "stderr", label: "stderr" },
  { id: "system", label: "system" },
] as const;

type StreamFilter = (typeof BASE_FILTERS)[number]["id"] | "debug";

function isActiveStatus(status?: string) {
  return status && ["queued", "assigned", "preparing", "running"].includes(status);
}

function matchesStreamFilter(entry: RunLogEntry, filter: StreamFilter): boolean {
  if (filter === "all") return true;
  if (filter === "normal") return entry.stream !== "debug";
  return entry.stream === filter;
}

function isDebugSectionHeader(message: string) {
  return message.startsWith("──") && message.endsWith("──");
}

export function RunLogViewer({
  logs,
  status,
  search,
  onSearchChange,
  debugRun = false,
  className,
}: {
  logs: RunLogEntry[];
  status?: string;
  search: string;
  onSearchChange: (value: string) => void;
  debugRun?: boolean;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const [follow, setFollow] = useState(true);
  const [streamFilter, setStreamFilter] = useState<StreamFilter>(debugRun ? "normal" : "all");
  const [copied, setCopied] = useState(false);
  const live = isActiveStatus(status);

  const hasDebugLogs = useMemo(() => logs.some((l) => l.stream === "debug"), [logs]);

  const streamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of logs) {
      counts[log.stream] = (counts[log.stream] ?? 0) + 1;
    }
    return counts;
  }, [logs]);

  const filters = useMemo((): { id: StreamFilter; label: string }[] => {
    const items: { id: StreamFilter; label: string }[] = [...BASE_FILTERS];
    if (debugRun || hasDebugLogs) {
      items.push({ id: "debug", label: "debug" });
    }
    return items;
  }, [debugRun, hasDebugLogs]);

  const filtered = logs.filter((l) => {
    if (!matchesStreamFilter(l, streamFilter)) return false;
    if (search && !l.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 64;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const handleScroll = useCallback(() => {
    const atBottom = isNearBottom();
    followRef.current = atBottom;
    setFollow(atBottom);
  }, [isNearBottom]);

  useEffect(() => {
    if (followRef.current) {
      scrollToBottom(logs.length > 3);
    }
  }, [logs, scrollToBottom]);

  useEffect(() => {
    if (live) {
      followRef.current = true;
      setFollow(true);
    }
  }, [live]);

  function enableFollow() {
    followRef.current = true;
    setFollow(true);
    scrollToBottom();
  }

  function copyLogs() {
    const text = filtered
      .map((l) => {
        const time = new Date(l.timestamp).toLocaleTimeString("fr-FR");
        return `${time} [${l.stream}] ${l.message}`;
      })
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border overflow-hidden bg-[#08080c] glow-subtle",
        "h-[calc(100dvh-17rem)] min-h-[320px] max-h-[calc(100dvh-10rem)]",
        className
      )}
    >
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border bg-card/60">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="font-medium">Logs</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {filtered.length}/{logs.length}
          </span>
          {live && (
            <span className="inline-flex items-center gap-1.5 text-xs text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              En direct
            </span>
          )}
          {(debugRun || hasDebugLogs) && (
            <span className="inline-flex items-center gap-1 text-[10px] text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded px-1.5 py-0.5">
              <Bug className="h-3 w-3" />
              debug
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border-subtle overflow-hidden">
            {filters.map((f) => {
              const count =
                f.id === "all"
                  ? logs.length
                  : f.id === "normal"
                    ? logs.filter((l) => l.stream !== "debug").length
                    : streamCounts[f.id] ?? 0;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStreamFilter(f.id)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-medium transition-colors",
                    streamFilter === f.id
                      ? f.id === "debug"
                        ? "bg-violet-500/20 text-violet-200"
                        : "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/80"
                  )}
                >
                  {f.label}
                  {count > 0 && (
                    <span className="ml-1 opacity-70 tabular-nums">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="relative w-40 sm:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filtrer…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={copyLogs}>
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copié" : "Copier"}
          </Button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden p-3 font-mono text-[13px] leading-relaxed overscroll-contain"
        >
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              {live
                ? "En attente des premiers logs du worker…"
                : logs.length > 0
                  ? "Aucun log ne correspond au filtre."
                  : "Aucun log pour cette exécution."}
            </p>
          ) : (
            filtered.map((l) => {
              const isDebug = l.stream === "debug";
              const isHeader = isDebug && isDebugSectionHeader(l.message);
              return (
                <div
                  key={l.sequence}
                  className={cn(
                    "flex gap-2 sm:gap-3 py-0.5 rounded px-1 -mx-1 group",
                    isDebug
                      ? "bg-violet-500/[0.04] hover:bg-violet-500/[0.07] border-l-2 border-violet-500/35 pl-2 ml-0"
                      : "hover:bg-white/[0.02]",
                    isHeader && "mt-2 first:mt-0"
                  )}
                >
                  <span className="text-muted-foreground shrink-0 w-[4.5rem] tabular-nums text-xs">
                    {new Date(l.timestamp).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 w-14 sm:w-16 text-xs font-medium",
                      STREAM_STYLES[l.stream] ?? "text-muted-foreground"
                    )}
                  >
                    [{l.stream}]
                  </span>
                  <span
                    className={cn(
                      "whitespace-pre-wrap break-all min-w-0 flex-1",
                      isDebug ? "text-violet-100/90" : "text-foreground/90",
                      isHeader && "font-semibold text-violet-200"
                    )}
                  >
                    {l.message}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {!follow && filtered.length > 0 && (
          <Button
            size="sm"
            className="absolute bottom-3 right-3 shadow-lg gap-1.5 h-8 text-xs"
            onClick={enableFollow}
          >
            <ArrowDown className="h-3.5 w-3.5" />
            Suivre
          </Button>
        )}
      </div>
    </div>
  );
}
