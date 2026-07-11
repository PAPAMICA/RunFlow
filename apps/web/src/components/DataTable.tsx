import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function DataTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto -mx-1", className)}>
      <table className="data-table">{children}</table>
    </div>
  );
}

export function DataTableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full rounded-lg" />
      ))}
    </div>
  );
}
