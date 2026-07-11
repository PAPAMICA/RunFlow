import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "default" | "muted" | "accent" }> = {
  success: { label: "Succès", variant: "success" },
  failed: { label: "Échec", variant: "destructive" },
  running: { label: "En cours", variant: "default" },
  preparing: { label: "Préparation", variant: "default" },
  assigned: { label: "Assigné", variant: "warning" },
  queued: { label: "En file", variant: "warning" },
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
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
