"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type SearchBarProps = {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  className?: string;
  showFilterIcon?: boolean;
  onFilterClick?: () => void;
  filterActive?: boolean;
  filterExpanded?: boolean;
  filterCount?: number;
  filterControls?: string;
};

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Search characters...",
  className,
  showFilterIcon = false,
  onFilterClick,
  filterActive = false,
  filterExpanded = false,
  filterCount = 0,
  filterControls
}: SearchBarProps) {
  return (
    <div className={cn("relative block w-full", className)}>
      <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onSubmit?.(value ?? event.currentTarget.value);
          }
        }}
        placeholder={placeholder}
        className="focus-ring glass-input h-12 w-full rounded-[var(--radius-pill)] px-12 text-sm focus:border-[var(--accent-purple)]"
      />
      {showFilterIcon ? (
        onFilterClick ? (
          <button
            type="button"
            aria-label="Open search filters"
            aria-controls={filterControls}
            aria-expanded={filterExpanded}
            onClick={onFilterClick}
            className={cn(
              "focus-ring absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border text-[var(--text-secondary)] xl:hidden",
              filterActive
                ? "border-[var(--codex-mint)]/55 bg-[color-mix(in_oklch,var(--codex-mint)_10%,transparent)] text-[var(--codex-mint)]"
                : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {filterCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--bg-base)] px-1 text-[10px] font-bold text-[var(--text-primary)]">
                {filterCount}
              </span>
            ) : null}
          </button>
        ) : (
          <span className="pointer-events-none absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] xl:hidden">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
        )
      ) : null}
    </div>
  );
}
