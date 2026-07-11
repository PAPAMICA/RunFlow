import { cn } from "@/lib/utils";
import { forwardRef, TextareaHTMLAttributes } from "react";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm",
        "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50",
        "disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
