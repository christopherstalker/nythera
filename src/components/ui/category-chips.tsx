"use client";

import { cn } from "@/lib/utils";

type CategoryChipsProps = {
  categories: string[];
  active?: string;
  onSelect?: (category: string) => void;
  className?: string;
};

export function CategoryChips({ categories, active, onSelect, className }: CategoryChipsProps) {
  return (
    <div className={cn("overflow-x-auto pb-1", className)}>
      <div className="flex min-w-fit gap-2.5">
        {categories.map((category) => {
          const selected = active === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => onSelect?.(category)}
              className={cn(
                "focus-ring rounded-full border px-4 py-2.5 text-sm font-medium backdrop-blur-xl transition duration-200",
                selected
                  ? "border-primary/[0.26] bg-primary/[0.14] text-foreground shadow-violet-hover"
                  : "border-[var(--border-default)] bg-[var(--bg-elevated)] text-muted-foreground hover:border-primary/[0.18] hover:bg-primary/[0.08] hover:text-foreground"
              )}
            >
              {category}
            </button>
          );
        })}
      </div>
    </div>
  );
}
