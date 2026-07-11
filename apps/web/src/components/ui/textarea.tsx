import { cn } from "@/lib/utils";
import { forwardRef, TextareaHTMLAttributes } from "react";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground",
        "shadow-sm shadow-black/10",
        "placeholder:text-muted-foreground/80",
        "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60",
        "disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
