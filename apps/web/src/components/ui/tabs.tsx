"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export function Tabs({
  items,
  active,
  onChange,
  className,
}: {
  items: { key: string; label: string; badge?: string | number; icon?: LucideIcon }[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto pb-px scrollbar-none", className)}>
      {items.map((item) => {
        const isActive = active === item.key;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={cn(
              "relative shrink-0 px-4 py-2.5 text-sm font-medium rounded-lg transition-all",
              isActive
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-card/80"
            )}
          >
            {isActive && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
            <span className="flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              {item.label}
              {item.badge != null && (
                <span className="rounded-full bg-card border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {item.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
