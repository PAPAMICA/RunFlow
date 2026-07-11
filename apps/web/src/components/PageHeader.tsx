import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  action,
  breadcrumb,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  className?: string;
}) {
  return (
    <header className={cn("mb-8 animate-slide-up", className)}>
      {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1.5 text-sm max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0 flex flex-wrap gap-2">{action}</div>}
      </div>
    </header>
  );
}
