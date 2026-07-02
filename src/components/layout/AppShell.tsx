"use client";

import { usePathname } from "next/navigation";
import { NavRail } from "@/components/nav/NavRail";
import { SidePanel } from "@/components/panel/SidePanel";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/admin");
  const isChatSurface = pathname.startsWith("/chat/");

  if (hideChrome) {
    return <main className="min-h-dvh bg-[var(--bg-base)]">{children}</main>;
  }

  return (
    <div id="app-shell" className="fixed inset-0 min-h-dvh overflow-hidden bg-[var(--bg-base)]">
      <NavRail />
      <div
        className={cn(
          "flex h-full min-w-0",
          isChatSurface ? "pb-0 pt-0" : "pb-[var(--bottom-nav-offset)] pt-0 md:pb-0 md:pt-[var(--top-bar-height)]"
        )}
      >
        <main className="min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
        <SidePanel />
      </div>
    </div>
  );
}
