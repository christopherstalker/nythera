import { cn } from "@/lib/utils";

export function SkeletonCard({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("h-[260px] w-full min-w-[172px] animate-pulse rounded-[var(--radius-lg)] bg-[var(--bg-elevated)] shadow-[var(--glass-highlight)]", className)} />;
}
