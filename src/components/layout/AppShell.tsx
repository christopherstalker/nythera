"use client";

import { usePathname } from "next/navigation";
import { NavRail } from "@/components/nav/NavRail";
import { SidePanel } from "@/components/panel/SidePanel";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register");
  const isChatSurface = pathname.startsWith("/chat/");
  const isRoomSurface = pathname.startsWith("/room/");
  const isImmersiveSurface = isChatSurface || isRoomSurface;

  if (hideChrome) {
    return <main className="min-h-dvh bg-[var(--bg-base)]">{children}</main>;
  }

  return (
    <div
      id="app-shell"
      data-route-family={isImmersiveSurface ? "story" : "codex"}
      className="living-codex-shell fixed inset-0 isolate min-h-dvh overflow-hidden bg-[var(--bg-base)]"
    >
      <NavRail />
      <div
        className={cn(
          "relative z-10 flex h-full min-w-0 md:pl-[var(--codex-rail-width)]",
          "pb-[calc(var(--codex-mobile-dock-height)+env(safe-area-inset-bottom))] md:pb-0"
        )}
      >
        <main className={cn("codex-main min-w-0 flex-1 overflow-y-auto", isImmersiveSurface && "overflow-hidden")}>
          {children}
        </main>
        {isImmersiveSurface ? <SidePanel /> : null}
      </div>
    </div>
  );
}
