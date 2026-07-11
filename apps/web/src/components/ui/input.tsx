import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground/70",
        "focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/50",
        "hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
