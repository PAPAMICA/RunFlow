import { cn } from "@/lib/utils";
import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { Sparkline } from "@/components/ui/sparkline";

type Tone = "primary" | "success" | "warning" | "destructive" | "accent" | "info";

const TONE_COLORS: Record<Tone, string> = {
  primary: "var(--primary)",
  success: "var(--success)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
  accent: "var(--accent)",
  info: "var(--info)",
};

const TONE_ICON: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  accent: "bg-accent/10 text-accent",
  info: "bg-info/10 text-info",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  tone = "primary",
  sparkline,
  className,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  tone?: Tone;
  sparkline?: number[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card/80 p-5 backdrop-blur-sm shadow-card",
        "transition-all duration-200 hover:border-border-strong",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && (
          <div className={cn("rounded-lg p-2 shrink-0 transition-colors", TONE_ICON[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <p className="text-3xl font-bold mt-3 tracking-tight tabular-nums">{value}</p>

      <div className="mt-2 flex items-end justify-between gap-3">
        {trend ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              trend === "up" && "text-success",
              trend === "down" && "text-destructive",
              trend === "neutral" && "text-muted-foreground"
            )}
          >
            {trend === "up" && <TrendingUp className="h-3.5 w-3.5" />}
            {trend === "down" && <TrendingDown className="h-3.5 w-3.5" />}
            {trendLabel ?? (trend === "up" ? "En hausse" : trend === "down" ? "En baisse" : "Stable")}
          </span>
        ) : (
          <span />
        )}
        {sparkline && sparkline.length > 1 && (
          <Sparkline data={sparkline} color={TONE_COLORS[tone]} width={96} height={32} className="opacity-80" />
        )}
      </div>
    </div>
  );
}
