import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  onAction,
  actionLabel,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-xl border border-dashed border-border bg-card/40">
      <div className="rounded-2xl bg-primary/10 p-4 mb-4">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm">{description}</p>
      {action}
      {onAction && actionLabel && (
        <Button onClick={onAction} className="mt-6">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
