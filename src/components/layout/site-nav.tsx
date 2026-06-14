"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, Compass, Home, KeyRound, LogOut, MessageSquare, Plus, Search, Settings, ShieldCheck, User } from "lucide-react";
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
const mobileLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/chats", label: "Chats", icon: MessageSquare },
  { href: "/create-character", label: "Create", icon: Plus },
  { href: "/settings", label: "Settings", icon: KeyRound }
];

type ProfilePreview = {
  username?: string | null;
  avatarUrl?: string | null;
};

export function SiteNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [profilePreview, setProfilePreview] = useState<ProfilePreview | null>(null);
  const isAuthenticated = status === "authenticated";
  const canUseAdmin = isPlatformAdminEmail(session?.user?.email);
  const links = canUseAdmin ? [...baseLinks, adminLink] : baseLinks;
  const displayName = profilePreview?.username ?? session?.user?.username ?? session?.user?.name ?? session?.user?.email ?? "Velora user";
  const avatarUrl = profilePreview?.avatarUrl ?? session?.user?.image ?? null;
  const initial = displayName[0] ?? "V";
  const showMobileDock = !(
    pathname.startsWith("/chat/") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/admin")
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setProfilePreview(null);
      return;
    }

    let cancelled = false;
    fetch("/api/profile", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!cancelled && body?.profile) {
          setProfilePreview({
            username: body.profile.username,
            avatarUrl: body.profile.avatarUrl
          });
        }
      })
      .catch(() => undefined);

    const onProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ profile?: ProfilePreview }>).detail;
      if (detail?.profile) {
        setProfilePreview({
          username: detail.profile.username,
          avatarUrl: detail.profile.avatarUrl
        });
      }
    };

    window.addEventListener("velora:profile-updated", onProfileUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("velora:profile-updated", onProfileUpdated);
    };
  }, [isAuthenticated]);

  return (
    <>
      <header className="sticky top-0 z-40 bg-background/68 backdrop-blur-2xl">
      <div className="container mx-auto flex h-[68px] max-w-[1360px] items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 no-underline">
          <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-primary/[0.09] shadow-inset">
            <img src="/icon.svg" alt="" className="h-full w-full object-cover" />
          </span>
          <span className="hidden text-base font-semibold tracking-tight sm:inline">
            Velora<span className="text-primary"> AI</span>
          </span>
        </Link>

        <div className="mx-auto hidden w-full max-w-[30rem] items-center md:flex">
          <label className="relative w-full">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="Search characters"
              placeholder="Search characters, moods, worlds..."
            className="focus-ring h-11 w-full rounded-full border border-white/[0.025] bg-white/[0.03] px-11 text-sm text-foreground shadow-inset placeholder:text-muted-foreground transition focus:border-primary/20 focus:bg-white/[0.055]"
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
                  "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground no-underline transition duration-200 hover:bg-white/[0.04] hover:text-foreground",
                  active && "bg-primary/[0.105] text-foreground shadow-inset"
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
                className="focus-ring flex h-10 items-center gap-2 rounded-full border border-white/[0.025] bg-white/[0.03] px-2 pr-3 shadow-inset transition hover:border-primary/[0.16] hover:bg-primary/[0.07]"
                onClick={() => setOpen((current) => !current)}
              >
                <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full border border-primary/30 bg-primary/[0.15] text-xs font-bold uppercase text-foreground">
                  {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initial}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {open ? (
                <div className="absolute right-0 mt-2 w-56 rounded-3xl border border-white/[0.035] bg-card/95 p-2 shadow-card-glow backdrop-blur-xl">
                  <div className="mb-1 flex items-center gap-3 rounded-2xl bg-white/[0.028] p-2">
                    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-primary/25 bg-primary/[0.12] text-sm font-bold uppercase">
                      {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initial}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">{session?.user?.email}</p>
                    </div>
                  </div>
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

      </header>
      {showMobileDock ? <MobileDock pathname={pathname} /> : null}
    </>
  );
}

function MobileDock({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Mobile primary navigation"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 rounded-[30px] border border-white/[0.035] bg-card/90 p-1.5 shadow-card-glow shadow-inset backdrop-blur-2xl lg:hidden"
    >
      <div className="grid grid-cols-5 gap-1">
        {mobileLinks.map((link) => {
          const Icon = link.icon;
          const active = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "focus-ring flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[22px] px-1 text-[11px] font-medium text-muted-foreground no-underline transition",
                active ? "bg-primary/[0.14] text-foreground shadow-inset" : "hover:bg-white/[0.055] hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="max-w-full truncate">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
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
