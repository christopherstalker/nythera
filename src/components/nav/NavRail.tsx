"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { BookMarked, Compass, Home, LogIn, LogOut, Plus, Settings, UserRound, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home, emphasis: false },
  { href: "/explore", label: "Explore", icon: Compass, emphasis: false },
  { href: "/library", label: "Library", icon: BookMarked, emphasis: false },
  { href: "/rooms", label: "Rooms", icon: UsersRound, emphasis: false },
  { href: "/create-character", label: "Create", icon: Plus, emphasis: true },
  { href: "/settings", label: "Settings", icon: Settings, emphasis: false }
];

export function NavRail() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const userLabel = session?.user?.name ?? session?.user?.email ?? "Account";
  const isChatSurface = pathname.startsWith("/chat/");

  if (isChatSurface) {
    return null;
  }

  return (
    <>
      <header className="fixed inset-x-0 top-4 z-50 hidden justify-center px-3 md:flex">
        <nav
          aria-label="Primary navigation"
          className="top-nav-island orbital-floating flex h-16 w-full max-w-[760px] items-center gap-2 overflow-hidden rounded-full px-3 xl:max-w-[920px]"
        >
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <IslandLink key={item.href} href={item.href} label={item.label} active={active} emphasis={item.emphasis} icon={Icon} />
              );
            })}
          </div>

          <div className="h-8 w-px shrink-0 bg-[oklch(var(--color-border-subtle)/0.28)]" />

          <AccountLinks pathname={pathname} isAuthenticated={isAuthenticated} userLabel={userLabel} />
        </nav>
      </header>

      <nav
        aria-label="Mobile primary navigation"
        className="mobile-nav-island orbital-floating fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-50 flex h-16 items-center justify-center gap-1 overflow-hidden rounded-full px-2 md:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return <MobileIslandLink key={item.href} href={item.href} label={item.label} active={active} icon={Icon} />;
        })}
        <div className="h-9 w-px shrink-0 bg-[oklch(var(--color-border-subtle)/0.28)]" />
        <AccountLinks pathname={pathname} isAuthenticated={isAuthenticated} userLabel={userLabel} mobile />
      </nav>
    </>
  );
}

function IslandLink({
  href,
  label,
  active,
  emphasis,
  icon: Icon
}: {
  href: string;
  label: string;
  active: boolean;
  emphasis?: boolean;
  icon: typeof Home;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "focus-ring flex h-10 min-w-0 shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full px-2 text-sm font-medium no-underline sm:px-3",
        "text-[oklch(var(--color-text-muted))]",
        "hover:bg-[oklch(var(--color-elevated)/0.42)] hover:text-[oklch(var(--color-text-primary))]",
        emphasis && "bg-aurora-primary text-[var(--text-primary)] shadow-glow-soft hover:bg-aurora-primary",
        active && "orbital-nav-active"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className={cn("hidden text-sm font-medium", active ? "lg:inline" : "xl:inline")}>{label}</span>
    </Link>
  );
}

function MobileIslandLink({
  href,
  label,
  active,
  icon: Icon
}: {
  href: string;
  label: string;
  active: boolean;
  icon: typeof Home;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "focus-ring grid h-12 flex-1 place-items-center rounded-full text-[oklch(var(--color-text-muted))] no-underline",
        "hover:bg-[oklch(var(--color-elevated)/0.42)] hover:text-[oklch(var(--color-text-primary))]",
        active && "orbital-nav-active"
      )}
    >
      <Icon className="h-6 w-6" />
    </Link>
  );
}

function AccountLinks({
  pathname,
  isAuthenticated,
  userLabel,
  mobile = false
}: {
  pathname: string;
  isAuthenticated: boolean;
  userLabel: string;
  mobile?: boolean;
}) {
  const sizeClass = mobile ? "h-12 flex-1" : "h-10 w-10";

  return (
    <>
      <Link
        href="/settings#persona"
        aria-label="Persona"
        className={cn(
          "focus-ring grid shrink-0 place-items-center rounded-full text-[oklch(var(--color-text-muted))] no-underline",
          sizeClass,
          "hover:bg-[oklch(var(--color-elevated)/0.42)] hover:text-[oklch(var(--color-text-primary))]",
          pathname === "/settings" && "orbital-nav-active"
        )}
      >
        <UserRound className={cn(mobile ? "h-6 w-6" : "h-5 w-5")} />
      </Link>

      {isAuthenticated ? (
        <button
          type="button"
          aria-label={`Sign out ${userLabel}`}
          onClick={() => void signOut({ callbackUrl: "/" })}
          className={cn(
            "focus-ring grid shrink-0 place-items-center rounded-full text-[oklch(var(--color-text-muted))]",
            sizeClass,
            "hover:bg-[oklch(var(--color-elevated)/0.42)] hover:text-[oklch(var(--color-text-primary))]"
          )}
        >
          <LogOut className={cn(mobile ? "h-6 w-6" : "h-5 w-5")} />
        </button>
      ) : (
        <Link
          href="/login"
          aria-label="Login"
          className={cn(
            "focus-ring grid shrink-0 place-items-center rounded-full text-[oklch(var(--color-text-muted))] no-underline",
            sizeClass,
            "hover:bg-[oklch(var(--color-elevated)/0.42)] hover:text-[oklch(var(--color-text-primary))]"
          )}
        >
          <LogIn className={cn(mobile ? "h-6 w-6" : "h-5 w-5")} />
        </Link>
      )}
    </>
  );
}
