import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("container mx-auto w-full max-w-[1360px] px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:py-10", className)}>
      {children}
    </div>
  );
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
    <div className={cn("flex flex-col justify-between gap-6 sm:flex-row sm:items-end", className)}>
      <div className="min-w-0">
        {Icon ? (
          <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-[22px] bg-primary/[0.085] text-primary shadow-inset">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        <h1 className="max-w-4xl text-[2.15rem] font-semibold leading-[1.08] tracking-tight text-foreground sm:text-[2.75rem]">
          {title}
        </h1>
        {description ? <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{description}</p> : null}
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
    <div className={cn("flex items-end justify-between gap-6", className)}>
      <div>
        <h2 className="text-xl font-semibold leading-8 tracking-tight text-foreground sm:text-2xl">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
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
