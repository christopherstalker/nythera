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
      <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9b9b9b]" />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className="focus-ring h-16 w-full rounded-[22px] border border-transparent bg-[#151515] px-14 text-[28px] font-black leading-none text-white placeholder:text-[#686868] transition-colors duration-200 focus:border-white/10 focus:bg-[#1a1a1a]"
      />
      {showFilterIcon ? (
        <span className="pointer-events-none absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
          <SlidersHorizontal className="h-4 w-4" />
        </span>
      ) : null}
    </label>
  );
}
