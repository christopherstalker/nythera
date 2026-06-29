"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Compass, Home, LogIn, Plus, Settings, UsersRound } from "lucide-react";
import { loginUrl } from "@/lib/auth-routes";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home", icon: Home, auth: "any" as const },
  { href: "/explore", label: "Explore", icon: Compass, auth: "any" as const },
  { href: "/rooms", label: "Rooms", icon: UsersRound, auth: "required" as const },
  { href: "/create-character", label: "Create", icon: Plus, auth: "required" as const },
  { href: "/settings", label: "Settings", icon: Settings, auth: "required" as const }
];

export function BottomNav() {
  const pathname = usePathname();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  return (
    <nav
      aria-label="Mobile primary navigation"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))] pt-2 md:hidden"
    >
      <div className="mobile-nav-shell mx-auto w-full max-w-lg rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-2 shadow-[var(--shadow-card)] backdrop-blur-2xl">
        <div className="grid grid-cols-[repeat(5,minmax(0,1fr))] gap-1">
          {links.map((link) => {
            const Icon = link.icon;
            const active = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`);
            const href = !isAuthenticated && link.auth === "required" ? loginUrl(link.href) : link.href;
            const label = !isAuthenticated && link.href === "/settings" ? "Sign in" : link.label;
            const LinkIcon = !isAuthenticated && link.href === "/settings" ? LogIn : Icon;

            return (
              <Link
                key={link.href}
                href={href}
                className={cn(
                  "mobile-nav-item focus-ring flex min-h-[var(--touch-target)] min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] font-medium text-[var(--text-secondary)] no-underline transition-all duration-150 active:scale-95",
                  active ? "bg-[var(--accent-purple-soft)] text-[var(--text-primary)] shadow-[var(--shadow-glow-soft)]" : "hover:bg-white/[0.055] hover:text-[var(--text-primary)]"
                )}
              >
                <LinkIcon className="h-5 w-5 shrink-0" />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
