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
      <div className="flex min-w-fit gap-2">
        {categories.map((category) => {
          const selected = active === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => onSelect?.(category)}
              className={cn(
                "focus-ring rounded-full border px-4 py-2 text-sm font-medium transition duration-200",
                selected
                  ? "border-primary/25 bg-primary/[0.1] text-[#e5ddff] shadow-violet-hover"
                  : "border-white/[0.045] bg-white/[0.028] text-muted-foreground hover:border-primary/20 hover:bg-primary/[0.075] hover:text-foreground"
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
