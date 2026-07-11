import { cn } from "@/lib/utils";

const variants = {
  default: "bg-primary/12 text-primary ring-1 ring-inset ring-primary/25",
  success: "bg-success/12 text-success ring-1 ring-inset ring-success/25",
  warning: "bg-warning/12 text-warning ring-1 ring-inset ring-warning/25",
  destructive: "bg-destructive/12 text-destructive ring-1 ring-inset ring-destructive/25",
  info: "bg-info/12 text-info ring-1 ring-inset ring-info/25",
  muted: "bg-surface-2 text-muted ring-1 ring-inset ring-border",
  accent: "bg-accent/12 text-accent ring-1 ring-inset ring-accent/25",
} as const;

export function Badge({
  className,
  variant = "default",
  children,
}: {
  className?: string;
  variant?: keyof typeof variants;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
