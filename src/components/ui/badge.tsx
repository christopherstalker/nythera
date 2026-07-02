import { cn } from "@/lib/utils";

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-outline bg-surface px-3 py-1 text-xs font-medium text-content-secondary",
        className
      )}
    >
      {children}
    </span>
  );
}
