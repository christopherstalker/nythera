import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SETTINGS_SECTIONS } from "@/components/settings/settings-sections";

export default function SettingsPage() {
  return (
    <div>
      <header className="mb-7 border-b border-[var(--border-default)] pb-6 sm:mb-9 sm:pb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[var(--text-muted)]">Account control center</p>
        <h1 className="mt-3 font-editorial text-[clamp(2.75rem,7vw,4.5rem)] font-medium leading-none text-[var(--text-primary)]">Settings</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
          Choose what to manage. Each area has its own page, so model keys, personas, memories, and profile controls no longer compete for space.
        </p>
      </header>

      <div className="grid gap-px border border-[var(--border-default)] bg-[var(--border-default)] sm:grid-cols-2">
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="group min-w-0 bg-[var(--bg-base)] p-5 no-underline transition-colors hover:bg-[color-mix(in_oklch,var(--codex-mint)_6%,var(--bg-base))] sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center border border-[var(--border-default)] text-[var(--accent-violet)] group-hover:text-[var(--codex-mint)]">
                  <Icon className="h-5 w-5" />
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--codex-mint)]" />
              </div>
              <h3 className="mt-5 font-editorial text-2xl font-medium text-[var(--text-primary)]">{section.label}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{section.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
