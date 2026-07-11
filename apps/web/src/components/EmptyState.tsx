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
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center rounded-2xl border border-dashed border-border bg-card/20">
      <div className="relative mb-5">
        <div className="absolute inset-0 blur-2xl bg-primary/20 rounded-full" aria-hidden />
        <div className="relative rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 p-5 ring-1 ring-primary/15">
          <Icon className="h-8 w-8 text-primary" />
        </div>
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
