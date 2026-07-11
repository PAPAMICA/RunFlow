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
        "rounded-xl border border-border bg-card/90 p-5 backdrop-blur-sm",
        "hover:border-primary/20 transition-colors group",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && (
          <div className="rounded-lg bg-primary/10 p-2 text-primary group-hover:bg-primary/15 transition-colors">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className="text-3xl font-bold mt-3 tracking-tight">{value}</p>
      {trend && (
        <p
          className={cn(
            "text-xs mt-2",
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
