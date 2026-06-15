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
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className="focus-ring h-12 w-full rounded-[var(--radius-pill)] border border-[var(--border-default)] bg-[var(--bg-input)] px-11 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors duration-200 focus:border-[var(--accent-purple)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-purple)]"
      />
      {showFilterIcon ? (
        <span className="pointer-events-none absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
          <SlidersHorizontal className="h-4 w-4" />
        </span>
      ) : null}
    </label>
  );
}
