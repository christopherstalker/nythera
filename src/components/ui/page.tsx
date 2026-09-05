import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResponsiveActions } from "@/components/ui/responsive-actions";

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
        "nythera-page-shell codex-page w-full overflow-x-hidden",
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
  className,
  compact = false
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <header
      className={cn(
        "codex-page-header grid gap-5 border-b border-[var(--codex-rule)] pb-7 md:grid-cols-[104px_minmax(0,1fr)_auto] md:items-end md:pb-9",
        compact && "codex-workspace-header",
        className
      )}
    >
      <div className="codex-page-register hidden self-stretch border-r border-[var(--codex-rule)] pr-5 md:flex">
        {Icon ? <Icon className="h-5 w-5 text-[var(--codex-mint)]" /> : null}
        <span>
          Living
          <br />
          Codex
        </span>
      </div>
      <div className="min-w-0">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-[.3em] text-[var(--codex-violet)]">
          Nythera / Archive
        </p>
        <h1 className="font-editorial max-w-4xl text-[clamp(2.75rem,5vw,4.5rem)] font-medium leading-[1.05] tracking-[-.035em] text-[var(--codex-ivory)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-5 max-w-2xl font-editorial text-lg italic leading-7 text-content-secondary sm:text-xl">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <ResponsiveActions align="end">{actions}</ResponsiveActions> : null}
    </header>
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
        <h2 className="font-editorial text-[clamp(1.75rem,3vw,2.7rem)] font-medium leading-none text-[var(--codex-ivory)]">
          {title}
        </h2>
        {description ? <p className="text-body mt-1 max-w-2xl text-content-secondary">{description}</p> : null}
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
  return <Comp className={cn("app-surface codex-surface", className)}>{children}</Comp>;
}

export function SurfaceMuted({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("app-surface-muted", className)}>{children}</div>;
}
