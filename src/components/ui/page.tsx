import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("container mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  className
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col justify-between gap-5 sm:flex-row sm:items-end", className)}>
      <div className="min-w-0">
        {Icon ? (
          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/[0.16] bg-primary/[0.075] text-primary shadow-inset">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        <h1 className="max-w-4xl text-[2rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2.45rem]">
          {title}
        </h1>
        {description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div>
        <h2 className="text-xl font-semibold leading-7 tracking-tight text-foreground sm:text-2xl">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Surface({
  children,
  className,
  as: Comp = "section"
}: {
  children: React.ReactNode;
  className?: string;
  as?: "section" | "article" | "aside" | "div" | "main";
}) {
  return <Comp className={cn("app-surface", className)}>{children}</Comp>;
}

export function SurfaceMuted({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("app-surface-muted", className)}>{children}</div>;
}
