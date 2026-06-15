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
    <div className="min-h-dvh bg-[var(--bg-base)]">
      <Sidebar />
      <main
        className={cn(
          "min-h-dvh bg-[var(--bg-base)] transition-[padding] duration-200 md:pl-[var(--sidebar-collapsed)] lg:pl-[var(--sidebar-width)]",
          sidebarCollapsed && "lg:pl-[var(--sidebar-collapsed)]"
        )}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
