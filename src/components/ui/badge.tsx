import { cn } from "@/lib/utils";

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-outline bg-surface/56 px-3 py-1 text-xs font-medium text-content-secondary shadow-raised backdrop-blur-xl",
        className
      )}
    >
      {children}
    </span>
  );
}
