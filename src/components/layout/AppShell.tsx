"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { NavRail } from "@/components/nav/NavRail";
import { MobileDock } from "@/components/nav/MobileDock";
import { SidePanel } from "@/components/panel/SidePanel";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const hideChrome =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth/new-user") ||
    pathname.startsWith("/auth/pwa") ||
    pathname.startsWith("/pwa-migrate");
  const isChatSurface = pathname.startsWith("/chat/");
  const isRoomSurface = pathname.startsWith("/room/");
  const isImmersiveSurface = isChatSurface || isRoomSurface;

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

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
      className="living-codex-shell fixed inset-0 isolate grid h-dvh min-h-0 w-full max-w-full grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-[var(--bg-base)] md:block"
    >
      <NavRail />
      <div
        className={cn(
          "relative z-10 flex h-full w-full max-w-full min-h-0 min-w-0 overflow-hidden md:pl-[var(--codex-rail-width)]"
        )}
      >
        <main ref={mainRef} className={cn("codex-main min-h-0 min-w-0 max-w-full flex-1 overflow-y-auto", isImmersiveSurface && "overflow-hidden")}>
          {children}
        </main>
        {isImmersiveSurface ? <SidePanel /> : null}
      </div>
      {!isChatSurface ? (
        <>
          <div aria-hidden className="h-[calc(var(--codex-mobile-dock-height)+env(safe-area-inset-bottom))] md:hidden" />
          <MobileDock />
        </>
      ) : null}
    </div>
  );
}
