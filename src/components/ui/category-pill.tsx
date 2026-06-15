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
        "focus-ring shrink-0 rounded-lg px-0 py-1.5 text-[17px] font-black transition-colors duration-150 active:scale-95 md:text-[19px]",
        active
          ? "text-white"
          : "text-[#5f5f5f] hover:text-[#bcbcbc]"
      )}
    >
      {label}
    </button>
  );
}
