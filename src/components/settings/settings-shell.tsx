"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/ui/page";
import { cn } from "@/lib/utils";
import { SETTINGS_SECTIONS } from "@/components/settings/settings-sections";

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isOverview = pathname === "/settings";

  useEffect(() => {
    if (!isOverview) return;

    const hash = window.location.hash.slice(1);
    const legacySection = SETTINGS_SECTIONS.find((section) => section.legacyHash === hash);
    if (legacySection) {
      router.replace(legacySection.href);
    }
  }, [isOverview, router]);

  return (
    <PageShell className="codex-settings codex-workspace">
      <div className="settings-layout grid min-w-0 border-y border-[var(--border-default)] lg:grid-cols-[248px_minmax(0,780px)] lg:justify-start">
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          {!isOverview ? (
            <div className="grid gap-2 border-b border-[var(--border-default)] px-1 py-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center lg:hidden">
              <Link
                href="/settings"
                className="focus-ring inline-flex min-h-11 items-center gap-2 px-2 text-xs font-medium uppercase tracking-[.14em] text-[var(--text-secondary)] no-underline hover:text-[var(--accent-mint)]"
              >
                <ArrowLeft className="h-4 w-4" />
                All settings
              </Link>
              <label className="grid gap-1 px-2 text-[10px] font-medium uppercase tracking-[.14em] text-[var(--text-muted)]">
                Jump to
                <select
                  value={SETTINGS_SECTIONS.some((section) => section.href === pathname) ? pathname : "/settings"}
                  onChange={(event) => router.push(event.target.value)}
                  className="focus-ring h-11 min-w-0 border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm normal-case tracking-normal text-[var(--text-primary)]"
                  aria-label="Jump to settings section"
                >
                  <option value="/settings">All settings</option>
                  {SETTINGS_SECTIONS.map((section) => (
                    <option key={section.href} value={section.href}>
                      {section.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <nav
            className="settings-section-nav hidden border-r border-[var(--border-default)] lg:grid"
            aria-label="Settings sections"
          >
            {SETTINGS_SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = pathname === section.href;

              return (
                <Link
                  key={section.href}
                  href={section.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-ring flex min-h-14 shrink-0 items-center gap-3 border-r border-[var(--border-default)] px-4 text-xs font-medium uppercase tracking-[.12em] text-[var(--text-secondary)] no-underline transition-colors duration-150 hover:text-[var(--accent-mint)] lg:border-b lg:border-r-0",
                    active && "bg-[color-mix(in_oklch,var(--codex-mint)_8%,transparent)] text-[var(--codex-mint)]"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {section.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 py-6 lg:pl-8">{children}</div>
      </div>
    </PageShell>
  );
}
