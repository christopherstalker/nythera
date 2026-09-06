"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { PageShell } from "@/components/ui/page";
import { SETTINGS_SECTIONS } from "@/components/settings/settings-sections";

const sectionOrder = [
  "/settings/interface",
  "/settings/atmosphere",
  "/settings/personas",
  "/settings/memory",
  "/settings/providers",
  "/settings/voice",
  "/account",
  "/settings/help"
];

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
    <PageShell className="story-studio">
      <header className="studio-heading">
        <div>
          <p className="studio-eyebrow">Nythera / Settings</p>
          <h1>Story Studio</h1>
          <p className="studio-heading-copy">A little less setup. A little more immersion.</p>
        </div>
        <Link href={chatId ? `/chat/${encodeURIComponent(chatId)}` : "/chats"} className="studio-back">
          ← Return to {chatId ? "your story" : "chats"}
        </Link>
      </header>
      <div className="studio-body">
        <label className="studio-mobile-nav">
          Section
          <select
            value={sections.some((section) => section.href === activePath) ? activePath : "/settings/interface"}
            aria-label="Jump to settings section"
            onChange={(event) => {
              document.querySelector<HTMLAnchorElement>(`[data-studio-href="${event.target.value}"]`)?.click();
            }}
          >
            {sections.map((section) => (
              <option key={section.href} value={section.href}>
                {section.label}
              </option>
            ))}
          </select>
        </label>
        <nav className="studio-navigation" aria-label="Settings sections">
          <p className="studio-nav-label">The experience</p>
          {sections.map((section, index) => {
            const active = activePath === section.href;
            return (
              <div key={section.href}>
                {index === 4 ? <p className="studio-nav-label studio-nav-divider">Behind the scenes</p> : null}
                <Link
                  href={sectionUrl(section.href)}
                  data-studio-href={section.href}
                  aria-current={active ? "page" : undefined}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {section.label}
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="studio-content">{children}</div>
      </div>
    </PageShell>
  );
}
