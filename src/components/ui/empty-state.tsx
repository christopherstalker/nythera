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
    <div className={cn("app-surface flex flex-col items-center px-8 py-16 text-center sm:py-20", className)}>
      <div className="grid h-14 w-14 place-items-center rounded-[24px] bg-primary/[0.085] text-primary shadow-inset">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-6 text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">{description}</p>
      {action ? <div className="mt-7">{action}</div> : null}
    </div>
  );
}
