import { cn } from "@/lib/utils";

export function SkeletonCard({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("h-[220px] w-[160px] animate-pulse rounded-xl bg-[var(--bg-elevated)]", className)} />;
}
