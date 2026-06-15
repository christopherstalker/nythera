import { cn } from "@/lib/utils";

export function SkeletonCard({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("inline-block h-[340px] w-[172px] animate-pulse rounded-[8px] bg-[#151515]", className)} />;
}
