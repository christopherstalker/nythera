"use client";

import { cn } from "@/lib/utils";

type CategoryPillProps = {
  label: string;
  active?: boolean;
  onClick?: () => void;
};

export function CategoryPill({ label, active = false, onClick }: CategoryPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring shrink-0 rounded-[var(--radius-pill)] px-4 py-1.5 text-sm font-medium transition-colors duration-150 active:scale-95",
        active
          ? "border border-white/10 bg-gradient-to-br from-[var(--accent-purple)] to-[var(--accent-secondary)] text-white shadow-[var(--shadow-glow)]"
          : "border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] backdrop-blur-xl hover:border-white/15 hover:bg-white/[0.055] hover:text-[var(--text-primary)]"
      )}
    >
      {label}
    </button>
  );
}
