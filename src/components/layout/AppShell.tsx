"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/layout/BottomNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { useUiStore } from "@/stores/use-ui-store";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const hideChrome =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/admin");

  if (hideChrome) {
    return <main className="min-h-dvh bg-[var(--bg-base)]">{children}</main>;
  }

  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-[var(--bg-base)]">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(150deg,rgb(11_11_18),rgb(13_14_25)_48%,rgb(9_11_19))]" />
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-primary/[0.08] to-transparent" />
      <Sidebar />
      <main
        className={cn(
          "min-h-dvh transition-[padding] duration-200 md:pl-[var(--sidebar-collapsed)] lg:pl-[var(--sidebar-width)]",
          sidebarCollapsed && "lg:pl-[var(--sidebar-collapsed)]"
        )}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
