"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type SearchBarProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  showFilterIcon?: boolean;
};

export function SearchBar({
  value,
  onChange,
  placeholder = "Search characters...",
  className,
  showFilterIcon = false
}: SearchBarProps) {
  return (
    <label className={cn("relative block w-full", className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className="focus-ring h-14 w-full rounded-full border border-white/[0.03] bg-white/[0.035] px-12 text-[15px] text-foreground shadow-card-glow shadow-inset placeholder:text-muted-foreground transition duration-200 focus:border-primary/[0.24] focus:bg-white/[0.06]"
      />
      {showFilterIcon ? (
        <span className="pointer-events-none absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-primary/10 text-primary">
          <SlidersHorizontal className="h-4 w-4" />
        </span>
      ) : null}
    </label>
  );
}
