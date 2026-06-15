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
  const immersiveChrome = pathname === "/" || pathname.startsWith("/explore") || pathname.startsWith("/chat/");
  const showSidebar = !immersiveChrome;
  const showBottomNav = !pathname.startsWith("/chat/");

  if (hideChrome) {
    return <main className="min-h-dvh bg-[var(--bg-base)]">{children}</main>;
  }

  return (
    <div className={cn("min-h-dvh", immersiveChrome ? "bg-[#050505]" : "bg-[var(--bg-base)]")}>
      {showSidebar ? <Sidebar /> : null}
      <main
        className={cn(
          "min-h-dvh transition-[padding] duration-200",
          immersiveChrome ? "bg-[#050505]" : "bg-[var(--bg-base)]",
          showSidebar && "md:pl-[var(--sidebar-collapsed)] lg:pl-[var(--sidebar-width)]",
          showSidebar && sidebarCollapsed && "lg:pl-[var(--sidebar-collapsed)]"
        )}
      >
        {children}
      </main>
      {showBottomNav ? <BottomNav /> : null}
    </div>
  );
}
