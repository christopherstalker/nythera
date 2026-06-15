import { cn } from "@/lib/utils";

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[var(--border-default)] bg-white/[0.045] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] shadow-[var(--glass-highlight)] backdrop-blur-xl",
        className
      )}
    >
      {children}
    </span>
  );
}
