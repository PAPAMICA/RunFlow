import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  hover = false,
}: {
  className?: string;
  children: React.ReactNode;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card/90 backdrop-blur-sm",
        hover && "transition-colors hover:bg-card-hover hover:border-border/80",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("px-5 pt-5 pb-2", className)}>{children}</div>;
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
