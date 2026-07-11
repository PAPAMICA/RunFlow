import { Badge } from "@/components/ui/badge";

const statusConfig: Record<
  string,
  { label: string; variant: "success" | "destructive" | "warning" | "default" | "muted" | "accent"; pulse?: boolean }
> = {
  success: { label: "Succès", variant: "success" },
  failed: { label: "Échec", variant: "destructive" },
  running: { label: "En cours", variant: "default", pulse: true },
  preparing: { label: "Préparation", variant: "default", pulse: true },
  assigned: { label: "Assigné", variant: "warning", pulse: true },
  queued: { label: "En file", variant: "warning", pulse: true },
  pending: { label: "En attente", variant: "muted" },
  timeout: { label: "Timeout", variant: "destructive" },
  cancelled: { label: "Annulé", variant: "muted" },
  skipped: { label: "Ignoré", variant: "muted" },
  online: { label: "En ligne", variant: "success" },
  offline: { label: "Hors ligne", variant: "muted" },
  enabled: { label: "Actif", variant: "success" },
  disabled: { label: "Inactif", variant: "muted" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, variant: "muted" as const };
  return (
    <Badge variant={config.variant} className="gap-1.5">
      {config.pulse && (
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-soft" />
      )}
      {config.label}
    </Badge>
  );
}
