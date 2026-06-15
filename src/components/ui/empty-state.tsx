import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("app-surface relative isolate flex flex-col items-center overflow-hidden px-8 py-16 text-center sm:py-20", className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b from-primary/[0.08] to-transparent" />
      <div className="grid h-16 w-16 place-items-center rounded-[24px] border border-primary/[0.18] bg-primary/[0.11] text-primary shadow-inset backdrop-blur-xl">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-6 text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">{description}</p>
      {action ? <div className="mt-7">{action}</div> : null}
    </div>
  );
}
