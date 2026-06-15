"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, MessageCircle, Plus, Settings, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/chats", label: "Chats", icon: MessageCircle },
  { href: "/create-character", label: "Create", icon: Plus, primary: true },
  { href: "/library", label: "Library", icon: Settings },
  { href: "/settings", label: "Profile", icon: UserRound }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile primary navigation"
      className="fixed bottom-0 left-1/2 z-50 w-[min(100%,620px)] -translate-x-1/2 bg-[#111] px-5 pb-[calc(0.65rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_40px_rgba(0,0,0,0.55)] md:bottom-4 md:rounded-[28px] md:border md:border-white/5"
    >
      <div className="grid grid-cols-5 gap-1">
        {links.map((link) => {
          const Icon = link.icon;
          const active = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "focus-ring flex h-12 flex-col items-center justify-center gap-1 rounded-full text-[10px] font-black text-[#555] no-underline transition duration-150 active:scale-95 md:h-14",
                link.primary
                  ? "mx-auto h-12 w-[62px] bg-[#fff200] text-black shadow-[0_0_24px_rgba(255,242,0,0.22)] hover:brightness-105 md:h-12"
                  : active
                    ? "text-white"
                    : "hover:text-[#bdbdbd]"
              )}
            >
              <Icon className={cn(link.primary ? "h-7 w-7 stroke-[4]" : "h-6 w-6 stroke-[2.8]")} />
              <span className="sr-only">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
