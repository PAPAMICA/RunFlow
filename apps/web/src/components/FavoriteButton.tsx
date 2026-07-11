"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  jobId,
  size = "icon",
  variant = "ghost",
  className,
  onChange,
}: {
  jobId: string;
  size?: "icon" | "sm";
  variant?: "ghost" | "outline";
  className?: string;
  onChange?: (favorited: boolean) => void;
}) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isFavorite(jobId));
  }, [jobId]);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = toggleFavorite(jobId);
    setActive(next);
    onChange?.(next);
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn("shrink-0", className)}
      title={active ? "Retirer des favoris" : "Ajouter aux favoris"}
    >
      <Star
        className={cn(
          "h-4 w-4 transition-colors",
          active ? "fill-warning text-warning" : "text-muted-foreground"
        )}
      />
    </Button>
  );
}
