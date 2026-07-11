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
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center rounded-xl border border-dashed border-border/80 bg-card/30">
      <div className="rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 p-5 mb-5 ring-1 ring-primary/10">
        <Icon className="h-9 w-9 text-primary" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">{description}</p>
      {action}
      {onAction && actionLabel && (
        <Button onClick={onAction} className="mt-6" size="lg">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
