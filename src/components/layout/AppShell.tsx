"use client";

import { usePathname } from "next/navigation";
import { NavRail } from "@/components/nav/NavRail";
import { MobileDock } from "@/components/nav/MobileDock";
import { SidePanel } from "@/components/panel/SidePanel";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth/new-user") ||
    pathname.startsWith("/auth/pwa") ||
    pathname.startsWith("/pwa-migrate");
  const isChatSurface = pathname.startsWith("/chat/");
  const isRoomSurface = pathname.startsWith("/room/");
  const isImmersiveSurface = isChatSurface || isRoomSurface;

  if (hideChrome) {
    return (
      <main className="h-dvh touch-pan-y overflow-y-auto overscroll-y-contain bg-[var(--bg-base)]">
        {children}
      </main>
    );
  }

  return (
    <div
      id="app-shell"
      data-route-family={isImmersiveSurface ? "story" : "codex"}
      className="living-codex-shell fixed inset-0 isolate grid min-h-dvh grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-[var(--bg-base)] md:block"
    >
      <NavRail />
      <div
        className={cn(
          "relative z-10 flex min-h-0 min-w-0 overflow-hidden md:h-full md:pl-[var(--codex-rail-width)]"
        )}
      >
        <main className={cn("codex-main min-h-0 min-w-0 flex-1 overflow-y-auto", isImmersiveSurface && "overflow-hidden")}>
          {children}
        </main>
        {isImmersiveSurface ? <SidePanel /> : null}
      </div>
      <MobileDock />
    </div>
  );
}
