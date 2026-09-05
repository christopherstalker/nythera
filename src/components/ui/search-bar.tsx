"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

type SearchBarProps = {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onClear?: () => void;
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
  onClear,
  placeholder = "Search characters...",
  className,
  showFilterIcon = false,
  onFilterClick,
  filterActive = false,
  filterExpanded = false,
  filterCount = 0,
  filterControls
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <form
      role="search"
      className={cn("relative block w-full", className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(value ?? "");
      }}
    >
      <button
        type="submit"
        aria-label="Search"
        className="focus-ring absolute left-2 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        <Search className="h-4 w-4" />
      </button>
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className={cn(
          "focus-ring glass-input h-12 w-full rounded-[var(--radius-pill)] pl-12 text-base sm:text-sm focus:border-[var(--accent-purple)] [&::-webkit-search-cancel-button]:appearance-none",
          showFilterIcon ? "pr-24 xl:pr-12" : "pr-12"
        )}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          className={cn(
            "focus-ring absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-[var(--text-secondary)]",
            showFilterIcon ? "right-11 xl:right-1" : "right-1"
          )}
          onClick={() => {
            onChange?.("");
            if (onClear) onClear();
            else onSubmit?.("");
            inputRef.current?.focus();
          }}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
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
    </form>
  );
}
