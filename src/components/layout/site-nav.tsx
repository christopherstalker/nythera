"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, Compass, KeyRound, LogOut, MessageSquare, Plus, Search, Settings, ShieldCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPlatformAdminEmail } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const baseLinks = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/chats", label: "Chats", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: KeyRound }
];

const adminLink = { href: "/admin", label: "Admin", icon: ShieldCheck };

export function SiteNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const isAuthenticated = status === "authenticated";
  const canUseAdmin = isPlatformAdminEmail(session?.user?.email);
  const links = canUseAdmin ? [...baseLinks, adminLink] : baseLinks;
  const initial = session?.user?.username?.[0] ?? session?.user?.email?.[0] ?? "V";

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.045] bg-background/78 backdrop-blur-2xl">
      <div className="container mx-auto flex h-16 max-w-[1480px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 no-underline">
          <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-2xl border border-primary/[0.18] bg-primary/[0.075] shadow-inset">
            <img src="/icon.svg" alt="" className="h-full w-full object-cover" />
          </span>
          <span className="hidden text-base font-semibold tracking-tight sm:inline">
            Velora<span className="text-primary"> AI</span>
          </span>
        </Link>

        <div className="mx-auto hidden w-full max-w-lg items-center md:flex">
          <label className="relative w-full">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Search characters"
              placeholder="Search characters, moods, worlds..."
              className="focus-ring h-11 w-full rounded-full border border-white/[0.055] bg-white/[0.035] px-11 text-sm text-foreground shadow-inset placeholder:text-muted-foreground transition focus:border-primary/35 focus:bg-white/[0.055]"
            />
          </label>
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground no-underline transition duration-200 hover:bg-white/[0.055] hover:text-foreground",
                  active && "bg-primary/[0.12] text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="secondary" size="sm" className="hidden sm:inline-flex">
            <Link href="/create-character">
              <Plus className="h-4 w-4" />
              Create
            </Link>
          </Button>
          <ThemeToggle />
          {isAuthenticated ? (
            <div className="relative">
              <button
                type="button"
                aria-label="Open user menu"
                className="focus-ring flex h-10 items-center gap-2 rounded-full border border-white/[0.055] bg-white/[0.035] px-2 pr-3 shadow-inset transition hover:border-primary/25 hover:bg-primary/[0.075]"
                onClick={() => setOpen((current) => !current)}
              >
                <span className="grid h-7 w-7 place-items-center rounded-full border border-primary/30 bg-primary/15 text-xs font-bold uppercase text-foreground">
                  {initial}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {open ? (
                <div className="absolute right-0 mt-2 w-56 rounded-3xl border border-white/[0.055] bg-card/95 p-2 shadow-card-glow backdrop-blur-xl">
                  <MenuLink href="/settings" icon={Settings} label="Settings" onClick={() => setOpen(false)} />
                  <MenuLink href="/chats" icon={MessageSquare} label="Chats" onClick={() => setOpen(false)} />
                  {canUseAdmin ? <MenuLink href="/admin" icon={ShieldCheck} label="Admin" onClick={() => setOpen(false)} /> : null}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-white/[0.055] hover:text-foreground"
                    onClick={() => void signOut({ callbackUrl: "/" })}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/login">
                <User className="h-4 w-4" />
                Sign in
              </Link>
            </Button>
          )}
        </div>
      </div>

      <nav className="container mx-auto flex h-12 max-w-[1480px] items-center gap-1 overflow-x-auto border-t border-white/[0.06] px-4 sm:px-6 lg:hidden">
        {[{ href: "/create-character", label: "Create", icon: Plus }, ...baseLinks].map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex min-w-fit items-center gap-2 rounded-full border border-transparent px-3 py-2 text-xs font-medium text-muted-foreground no-underline transition",
                active ? "border-primary/25 bg-primary/[0.12] text-foreground" : "hover:bg-white/[0.055] hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  onClick
}: {
  href: string;
  icon: typeof Settings;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm text-muted-foreground no-underline transition hover:bg-white/[0.055] hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
