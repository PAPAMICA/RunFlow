import { cn } from "@/lib/utils";

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 p-1 rounded-lg bg-card/60 border border-border">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
            value === opt.value
              ? "bg-primary/15 text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-card-hover"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
