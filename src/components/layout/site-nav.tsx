"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Bot, ChevronDown, Compass, KeyRound, LogOut, MessageSquare, Plus, Search, Settings, ShieldCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const links = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/chats", label: "Chats", icon: MessageSquare },
  { href: "/settings", label: "Keys", icon: KeyRound },
  { href: "/admin", label: "Admin", icon: ShieldCheck }
];

export function SiteNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const isAuthenticated = status === "authenticated";
  const initial = session?.user?.username?.[0] ?? session?.user?.email?.[0] ?? "V";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="container flex h-16 items-center gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 no-underline">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-primary/50 bg-primary/15 text-primary shadow-card-glow">
            <Bot className="h-5 w-5" />
          </span>
          <span className="hidden text-base font-bold tracking-tight sm:inline">
            Velora<span className="text-primary">AI</span>
          </span>
        </Link>

        <div className="mx-auto hidden w-full max-w-xl items-center md:flex">
          <label className="relative w-full">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Search characters"
              placeholder="Search characters..."
              className="focus-ring h-11 w-full rounded-full border border-border bg-card px-11 text-sm text-foreground placeholder:text-muted-foreground transition focus:border-primary"
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
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground no-underline transition duration-200 hover:bg-primary/10 hover:text-foreground",
                  active && "bg-primary/15 text-primary"
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="hidden border-primary/45 text-primary hover:border-primary sm:inline-flex">
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
                className="focus-ring flex h-10 items-center gap-2 rounded-full border border-border bg-card px-2 pr-3 transition hover:border-primary/45 hover:bg-primary/10"
                onClick={() => setOpen((current) => !current)}
              >
                <span className="grid h-7 w-7 place-items-center rounded-full border border-primary bg-primary/15 text-xs font-bold uppercase text-primary">
                  {initial}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {open ? (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-border bg-card p-2 shadow-card-glow">
                  <MenuLink href="/settings" icon={Settings} label="Settings" onClick={() => setOpen(false)} />
                  <MenuLink href="/chats" icon={MessageSquare} label="Chats" onClick={() => setOpen(false)} />
                  <MenuLink href="/admin" icon={ShieldCheck} label="Admin" onClick={() => setOpen(false)} />
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-primary/10 hover:text-foreground"
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

      <nav className="container flex h-12 items-center gap-1 overflow-x-auto border-t border-border lg:hidden">
        {[{ href: "/create-character", label: "Create", icon: Plus }, ...links.slice(0, 3)].map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex min-w-fit items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-muted-foreground no-underline transition",
                active && "bg-primary/15 text-primary"
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
      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground no-underline transition hover:bg-primary/10 hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
