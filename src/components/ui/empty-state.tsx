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
    <div className={cn("app-surface relative isolate flex w-full max-w-full flex-col items-center overflow-hidden px-5 py-14 text-center sm:px-8 sm:py-20", className)}>
      <div className="grid h-16 w-16 place-items-center rounded-[24px] border border-outline-strong bg-elevated text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-6 max-w-full text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mx-auto mt-3 w-full max-w-[300px] text-sm leading-7 text-muted-foreground sm:max-w-md">{description}</p>
      {action ? <div className="mt-7">{action}</div> : null}
    </div>
  );
}
