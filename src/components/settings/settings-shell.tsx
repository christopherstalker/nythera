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
    <PageShell className="codex-settings">
      <div className="settings-layout grid min-w-0 border-y border-[var(--border-default)] lg:grid-cols-[248px_minmax(0,780px)] lg:justify-start">
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-center justify-between border-b border-[var(--border-default)] px-1 py-3 lg:hidden">
            {isOverview ? (
              <p className="text-xs font-medium uppercase tracking-[.16em] text-[var(--text-secondary)]">Choose a section</p>
            ) : (
              <Link href="/settings" className="focus-ring inline-flex min-h-11 items-center gap-2 px-2 text-xs font-medium uppercase tracking-[.14em] text-[var(--text-secondary)] no-underline hover:text-[var(--accent-mint)]">
                <ArrowLeft className="h-4 w-4" />
                All settings
              </Link>
            )}
          </div>

          <nav className="settings-section-nav scrollbar-none flex w-full max-w-full overflow-x-auto border-b border-[var(--border-default)] lg:grid lg:overflow-visible lg:border-b-0 lg:border-r" aria-label="Settings sections">
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

        <main className="min-w-0 py-7 sm:py-9 lg:pl-10">{children}</main>
      </div>
    </PageShell>
  );
}
