import { cn } from "@/lib/utils";

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-white/[0.03] bg-white/[0.026] px-3 py-1 text-xs font-medium text-muted-foreground shadow-inset",
        className
      )}
    >
      {children}
    </span>
  );
}
