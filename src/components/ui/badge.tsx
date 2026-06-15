import { cn } from "@/lib/utils";

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.045] px-3 py-1 text-xs font-medium text-muted-foreground shadow-inset backdrop-blur-xl",
        className
      )}
    >
      {children}
    </span>
  );
}
