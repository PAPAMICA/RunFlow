import { cn } from "@/lib/utils";

const variants = {
  default: "bg-primary/15 text-primary border-primary/25",
  success: "bg-success/15 text-success border-success/25",
  warning: "bg-warning/15 text-warning border-warning/25",
  destructive: "bg-destructive/15 text-destructive border-destructive/25",
  muted: "bg-card text-muted border-border",
  accent: "bg-accent/15 text-accent border-accent/25",
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
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
