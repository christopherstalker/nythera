"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { BookMarked, Compass, Home, LogIn, LogOut, Plus, Settings, UserRound, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/library", label: "Library", icon: BookMarked },
  { href: "/rooms", label: "Rooms", icon: UsersRound },
  { href: "/create-character", label: "Create", icon: Plus },
  { href: "/settings", label: "Settings", icon: Settings }
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
          className="top-nav-island flex h-14 w-full max-w-[760px] items-center gap-2 overflow-hidden rounded-full border border-[oklch(var(--color-border-subtle)/0.55)] px-3"
          style={islandStyle}
        >
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <IslandLink key={item.href} href={item.href} label={item.label} active={active} icon={Icon} />
              );
            })}
          </div>

          <div className="h-8 w-px shrink-0 bg-[oklch(var(--color-border-subtle)/0.45)]" />

          <AccountLinks pathname={pathname} isAuthenticated={isAuthenticated} userLabel={userLabel} />
        </nav>
      </header>

      <nav
        aria-label="Mobile primary navigation"
        className="mobile-nav-island fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-50 flex h-16 items-center justify-center gap-1 overflow-hidden rounded-full border border-[oklch(var(--color-border-subtle)/0.55)] px-2 md:hidden"
        style={islandStyle}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return <MobileIslandLink key={item.href} href={item.href} label={item.label} active={active} icon={Icon} />;
        })}
        <div className="h-9 w-px shrink-0 bg-[oklch(var(--color-border-subtle)/0.45)]" />
        <AccountLinks pathname={pathname} isAuthenticated={isAuthenticated} userLabel={userLabel} mobile />
      </nav>
    </>
  );
}

const islandStyle = {
  background: "color-mix(in oklch, oklch(var(--color-surface)) 86%, transparent)",
  backdropFilter: "blur(var(--glass-blur-md)) saturate(var(--glass-saturation))",
  WebkitBackdropFilter: "blur(var(--glass-blur-md)) saturate(var(--glass-saturation))",
  boxShadow: "var(--shadow-card)"
};

function IslandLink({
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
        "focus-ring flex h-10 min-w-0 shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full px-2 text-sm font-medium no-underline sm:px-3",
        "text-[oklch(var(--color-text-muted))]",
        "hover:bg-[oklch(var(--color-elevated))] hover:text-[oklch(var(--color-text-primary))]",
        active && "bg-[oklch(var(--color-elevated))] text-[oklch(var(--color-text-primary))]"
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
        "hover:bg-[oklch(var(--color-elevated))] hover:text-[oklch(var(--color-text-primary))]",
        active && "bg-[oklch(var(--color-elevated))] text-[oklch(var(--color-text-primary))]"
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
          "hover:bg-[oklch(var(--color-elevated))] hover:text-[oklch(var(--color-text-primary))]",
          pathname === "/settings" && "bg-[oklch(var(--color-elevated))] text-[oklch(var(--color-text-primary))]"
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
            "hover:bg-[oklch(var(--color-elevated))] hover:text-[oklch(var(--color-text-primary))]"
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
            "hover:bg-[oklch(var(--color-elevated))] hover:text-[oklch(var(--color-text-primary))]"
          )}
        >
          <LogIn className={cn(mobile ? "h-6 w-6" : "h-5 w-5")} />
        </Link>
      )}
    </>
  );
}
