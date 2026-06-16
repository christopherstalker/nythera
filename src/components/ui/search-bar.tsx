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
};

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Search characters...",
  className,
  showFilterIcon = false
}: SearchBarProps) {
  return (
    <label className={cn("relative block w-full", className)}>
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
        <span className="pointer-events-none absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
          <SlidersHorizontal className="h-4 w-4" />
        </span>
      ) : null}
    </label>
  );
}
