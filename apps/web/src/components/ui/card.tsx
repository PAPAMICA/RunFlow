import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  hover = false,
  interactive = false,
}: {
  className?: string;
  children: React.ReactNode;
  hover?: boolean;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card shadow-card",
        (hover || interactive) &&
          "transition-all duration-200 hover:border-border-strong hover:bg-card-hover",
        interactive && "cursor-pointer hover:-translate-y-0.5 hover:shadow-elevated",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-5 pt-5 pb-3", className)}>{children}</div>;
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h3 className={cn("text-base font-semibold tracking-tight", className)}>{children}</h3>;
}

export function CardDescription({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn("text-sm text-muted-foreground mt-1", className)}>{children}</p>;
}

export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-5 pb-5", className)}>{children}</div>;
}
