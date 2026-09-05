import type { LucideIcon } from "lucide-react";

export function SettingsPageHeader({
  icon: Icon,
  title,
  description
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-7 border-b border-[var(--border-default)] pb-6 sm:mb-9 sm:pb-8">
      <div className="mb-4 flex items-center gap-3 text-[var(--accent-violet)]">
        <span className="grid h-10 w-10 place-items-center border border-[var(--border-default)]">
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[.22em] text-[var(--text-muted)]">
          Account settings
        </span>
      </div>
      <h1 className="font-editorial text-[clamp(2rem,3.5vw,3rem)] font-medium leading-tight text-[var(--text-primary)]">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">{description}</p>
    </header>
  );
}
