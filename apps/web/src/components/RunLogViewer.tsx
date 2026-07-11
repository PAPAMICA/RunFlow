"use client";

import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

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
};

function isActiveStatus(status?: string) {
  return status && ["queued", "assigned", "preparing", "running"].includes(status);
}

export function RunLogViewer({
  logs,
  status,
  search,
  onSearchChange,
}: {
  logs: RunLogEntry[];
  status?: string;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const filtered = search
    ? logs.filter((l) => l.message.toLowerCase().includes(search.toLowerCase()))
    : logs;

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="flex flex-col h-full min-h-[420px] rounded-xl border border-border overflow-hidden bg-[#0a0a0f]">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-card/60">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">Logs</span>
          <span className="text-muted-foreground text-xs">{filtered.length} ligne(s)</span>
          {isActiveStatus(status) && (
            <span className="inline-flex items-center gap-1.5 text-xs text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              En direct
            </span>
          )}
        </div>
        <div className="relative w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filtrer…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 font-mono text-[13px] leading-relaxed">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            {isActiveStatus(status)
              ? "En attente des premiers logs du worker…"
              : "Aucun log pour cette exécution."}
          </p>
        ) : (
          filtered.map((l) => (
            <div key={l.sequence} className="flex gap-3 py-0.5 hover:bg-white/[0.02] rounded px-1 -mx-1">
              <span className="text-muted-foreground shrink-0 w-[4.5rem] tabular-nums">
                {new Date(l.timestamp).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span className={`shrink-0 w-16 ${STREAM_STYLES[l.stream] ?? "text-muted-foreground"}`}>
                [{l.stream}]
              </span>
              <span className="whitespace-pre-wrap break-all text-foreground/90">{l.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
