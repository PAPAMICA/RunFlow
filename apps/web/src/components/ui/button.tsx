import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:opacity-50",
          variant === "default" &&
            "bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/20",
          variant === "secondary" &&
            "bg-card border border-border text-foreground hover:bg-card-hover",
          variant === "outline" &&
            "border border-border bg-transparent hover:bg-card hover:border-primary/30",
          variant === "ghost" && "hover:bg-card text-muted hover:text-foreground",
          variant === "destructive" &&
            "bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25",
          size === "default" && "h-10 px-4 py-2 text-sm",
          size === "sm" && "h-8 px-3 text-xs",
          size === "lg" && "h-11 px-6 text-sm",
          size === "icon" && "h-9 w-9",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
