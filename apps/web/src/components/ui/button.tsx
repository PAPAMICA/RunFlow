import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
          "[&_svg]:shrink-0",
          variant === "default" &&
            "bg-primary text-primary-foreground hover:brightness-95 shadow-sm",
          variant === "secondary" &&
            "bg-elevated border border-border text-foreground hover:bg-card-hover hover:border-border-strong",
          variant === "outline" &&
            "border border-border bg-transparent hover:bg-card hover:border-border-strong",
          variant === "ghost" && "text-muted hover:bg-card hover:text-foreground",
          variant === "destructive" &&
            "bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25",
          size === "default" && "h-10 px-4 text-sm [&_svg]:size-4",
          size === "sm" && "h-8 px-3 text-xs [&_svg]:size-3.5",
          size === "lg" && "h-11 px-6 text-sm [&_svg]:size-4",
          size === "icon" && "h-10 w-10 [&_svg]:size-4",
          size === "icon-sm" && "h-8 w-8 [&_svg]:size-3.5",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
