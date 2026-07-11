import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  className,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card/90 p-5 backdrop-blur-sm glow-subtle",
        "hover:border-primary/20 transition-all group",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && (
          <div className="rounded-lg bg-primary/10 p-2 text-primary group-hover:bg-primary/15 transition-colors shrink-0">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className="text-3xl font-bold mt-3 tracking-tight tabular-nums">{value}</p>
      {trend && (
        <p
          className={cn(
            "text-xs mt-2 font-medium",
            trend === "up" && "text-success",
            trend === "down" && "text-destructive",
            trend === "neutral" && "text-muted-foreground"
          )}
        >
          {trend === "up" && "↑ En hausse"}
          {trend === "down" && "↓ En baisse"}
          {trend === "neutral" && "— Stable"}
        </p>
      )}
    </div>
  );
}
