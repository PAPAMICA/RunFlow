import { cn } from "@/lib/utils";

type Variant = "success" | "destructive" | "warning" | "default" | "muted" | "accent" | "info";

const statusConfig: Record<string, { label: string; variant: Variant; pulse?: boolean }> = {
  success: { label: "Succès", variant: "success" },
  failed: { label: "Échec", variant: "destructive" },
  running: { label: "En cours", variant: "default", pulse: true },
  preparing: { label: "Préparation", variant: "info", pulse: true },
  assigned: { label: "Assigné", variant: "warning", pulse: true },
  queued: { label: "En file", variant: "warning", pulse: true },
  pending: { label: "En attente", variant: "muted" },
  timeout: { label: "Timeout", variant: "destructive" },
  cancelled: { label: "Annulé", variant: "muted" },
  skipped: { label: "Ignoré", variant: "muted" },
  online: { label: "En ligne", variant: "success", pulse: true },
  offline: { label: "Hors ligne", variant: "muted" },
  enabled: { label: "Actif", variant: "success" },
  disabled: { label: "Inactif", variant: "muted" },
};

const DOT: Record<Variant, string> = {
  success: "bg-success",
  destructive: "bg-destructive",
  warning: "bg-warning",
  default: "bg-primary",
  info: "bg-info",
  accent: "bg-accent",
  muted: "bg-muted-foreground",
};

const CHIP: Record<Variant, string> = {
  success: "text-success ring-success/25 bg-success/10",
  destructive: "text-destructive ring-destructive/25 bg-destructive/10",
  warning: "text-warning ring-warning/25 bg-warning/10",
  default: "text-primary ring-primary/25 bg-primary/10",
  info: "text-info ring-info/25 bg-info/10",
  accent: "text-accent ring-accent/25 bg-accent/10",
  muted: "text-muted ring-border bg-surface-2",
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, variant: "muted" as const };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        CHIP[config.variant]
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          DOT[config.variant],
          config.pulse && "animate-pulse-soft"
        )}
      />
      {config.label}
    </span>
  );
}
