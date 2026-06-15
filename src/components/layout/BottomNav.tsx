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
      className="fixed bottom-3 left-3 z-50 max-w-md rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-2 shadow-[var(--shadow-card)] backdrop-blur-2xl md:hidden"
      style={{ width: "min(366px, calc(100vw - 24px))" }}
    >
      <div className="grid grid-cols-[repeat(5,minmax(0,1fr))] gap-1">
        {links.map((link) => {
          const Icon = link.icon;
          const active = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "focus-ring flex h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium text-[var(--text-secondary)] no-underline transition-all duration-150 active:scale-95",
                active ? "bg-[var(--accent-purple-soft)] text-[var(--text-primary)] shadow-[var(--glass-highlight)]" : "hover:bg-white/[0.055] hover:text-[var(--text-primary)]"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
