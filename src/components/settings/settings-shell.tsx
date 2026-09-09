"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { PageHeader, PageShell } from "@/components/ui/page";
import { SETTINGS_SECTIONS } from "@/components/settings/settings-sections";

const sectionOrder = [
  "/settings/appearance",
  "/settings/interface",
  "/settings/atmosphere",
  "/settings/personas",
  "/settings/memory",
  "/settings/providers",
  "/settings/voice",
  "/account",
  "/settings/help"
];

const navigationLabels: Record<string, string> = {
  "/settings/memory": "Memory",
  "/settings/providers": "Models",
  "/settings/help": "Help"
};

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatId = searchParams.get("chatId");
  const activePath = pathname === "/settings" ? "/settings/interface" : pathname;
  const sections = sectionOrder.map((href) => SETTINGS_SECTIONS.find((section) => section.href === href)!);

  function sectionUrl(href: string) {
    return chatId && ["/settings/interface", "/settings/atmosphere"].includes(href)
      ? `${href}?${new URLSearchParams({ chatId })}`
      : href;
  }

  useEffect(() => {
    if (pathname !== "/settings") return;
    const legacySection = SETTINGS_SECTIONS.find((section) => section.legacyHash === window.location.hash.slice(1));
    if (legacySection) router.replace(legacySection.href);
  }, [pathname, router]);

  return (
    <PageShell className="codex-workspace story-studio">
      <PageHeader
        compact
        title="Settings"
        description="Make room for your kind of story."
        actions={
          chatId ? (
            <Link href={`/chat/${encodeURIComponent(chatId)}`} className="studio-back">
              ← Back to your chat
            </Link>
          ) : undefined
        }
      />
      <nav className="studio-navigation" aria-label="Settings sections">
        {sections.map((section) => {
          const active = activePath === section.href;
          return (
            <Link
              key={section.href}
              href={sectionUrl(section.href)}
              aria-label={section.label}
              aria-current={active ? "page" : undefined}
            >
              {navigationLabels[section.href] || section.label}
            </Link>
          );
        })}
      </nav>
      <div className="studio-content">{children}</div>
    </PageShell>
  );
}
