"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileGuestBar } from "@/components/layout/MobileGuestBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { AuroraWebglBackground } from "@/components/ambient/aurora-webgl-background";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/admin");
  const isChatRoute = pathname.startsWith("/chat/") || pathname.startsWith("/room/");

  if (hideChrome) {
    return <main className="min-h-dvh bg-[var(--bg-base)]">{children}</main>;
  }

  return (
    <div className="relative isolate min-h-dvh bg-[var(--bg-base)]">
      <AuroraWebglBackground />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10" style={{ background: "var(--app-shell-gradient)" }} />
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-primary/[0.08] to-transparent" />
      <Sidebar />
      <MobileGuestBar />
      <main className="min-h-dvh max-md:pb-[var(--bottom-nav-offset)] md:pl-[96px]">
        {children}
      </main>
      {isChatRoute ? null : <BottomNav />}
    </div>
  );
}
