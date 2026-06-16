import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageShell({
  children,
  className,
  variant = "default"
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "chat";
}) {
  return (
    <div
      className={cn(
        "nythera-page-shell w-full overflow-x-hidden md:px-[max(var(--page-padding-x),1.5rem)] lg:px-10",
        variant === "chat" && "nythera-page-shell-chat",
        className
      )}
    >
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
    <div className={cn("flex flex-col justify-between gap-4 sm:gap-5 md:flex-row md:items-end", className)}>
      <div className="min-w-0">
        {Icon ? (
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--accent-purple-soft)] text-[var(--accent-purple)] shadow-[var(--glass-highlight)] backdrop-blur-xl sm:mb-5">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        <h1 className="text-display max-w-4xl font-semibold tracking-tight text-[var(--text-primary)]">{title}</h1>
        {description ? <p className="text-subtitle mt-2 max-w-2xl text-[var(--text-secondary)] sm:mt-3">{description}</p> : null}
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
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6", className)}>
      <div className="min-w-0">
        <h2 className="text-title font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
        {description ? <p className="text-subtitle mt-1 max-w-2xl text-[var(--text-secondary)]">{description}</p> : null}
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
