import { cn } from "@/lib/utils";

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-medium text-foreground/90", className)}
      {...props}
    >
      {children}
    </label>
  );
}
