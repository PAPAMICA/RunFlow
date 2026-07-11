import { cn } from "@/lib/utils";
import { forwardRef, SelectHTMLAttributes } from "react";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";
