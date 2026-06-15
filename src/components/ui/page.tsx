import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-full overflow-x-hidden px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-5 md:px-7 md:py-8 lg:px-10 xl:max-w-[1240px]", className)}>
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
    <div className={cn("flex flex-col justify-between gap-5 sm:flex-row sm:items-end", className)}>
      <div className="min-w-0">
        {Icon ? (
          <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--accent-purple-soft)] text-[var(--accent-purple)] shadow-[var(--glass-highlight)] backdrop-blur-xl">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        <h1 className="max-w-4xl text-[2.15rem] font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-[2.75rem]">
          {title}
        </h1>
        {description ? <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-secondary)] sm:text-base">{description}</p> : null}
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
        <h2 className="text-xl font-semibold leading-8 tracking-tight text-[var(--text-primary)]">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p> : null}
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
