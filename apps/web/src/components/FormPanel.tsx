import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FormPanel({
  title,
  description,
  onClose,
  children,
  className,
}: {
  title: string;
  description?: string;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("panel-form mb-6 glow-subtle animate-slide-up", className)}>
      <div className="panel-form-header">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
