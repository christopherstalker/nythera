"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookMarked, Compass, Home, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/library", label: "Library", icon: BookMarked },
  { href: "/create-character", label: "Create", icon: Plus },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile primary navigation"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))] pt-2 md:hidden"
    >
      <div className="mx-auto w-full max-w-lg rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-2 shadow-[var(--shadow-card)] backdrop-blur-2xl">
        <div className="grid grid-cols-[repeat(5,minmax(0,1fr))] gap-1">
          {links.map((link) => {
            const Icon = link.icon;
            const active = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "focus-ring flex min-h-[var(--touch-target)] min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] font-medium text-[var(--text-secondary)] no-underline transition-all duration-150 active:scale-95",
                  active ? "bg-[var(--accent-purple-soft)] text-[var(--text-primary)] shadow-[var(--shadow-glow-soft)]" : "hover:bg-white/[0.055] hover:text-[var(--text-primary)]"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="max-w-full truncate">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
