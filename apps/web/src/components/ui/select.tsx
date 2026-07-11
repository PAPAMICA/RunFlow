import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { forwardRef, SelectHTMLAttributes } from "react";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative w-full">
      <select
        ref={ref}
        className={cn(
          "flex h-10 w-full appearance-none rounded-lg border border-border bg-surface-2/60 px-3 py-2 pr-9 text-sm text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50 transition-colors",
          "hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  )
);
Select.displayName = "Select";
