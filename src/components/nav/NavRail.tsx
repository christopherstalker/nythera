"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Books,
  Compass,
  GearSix,
  House,
  Plus,
  SignIn,
  SignOut,
  UserCircle,
  UsersThree
} from "@phosphor-icons/react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

const primaryItems = [
  { href: "/", label: "Home", icon: House },
  { href: "/explore", label: "Discover", icon: Compass },
  { href: "/library", label: "Library", icon: Books },
  { href: "/rooms", label: "Rooms", icon: UsersThree },
  { href: "/create-character", label: "Create", icon: Plus }
];

export function NavRail() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const userLabel = session?.user?.name ?? session?.user?.email ?? "Account";
  const isCharacterStudio = pathname === "/create-character" || /^\/character\/[^/]+\/edit$/.test(pathname);

  return (
    <>
      <aside className="codex-rail fixed inset-y-0 left-0 z-50 hidden w-[var(--codex-rail-width)] flex-col items-center border-r border-[var(--codex-rule)] md:flex">
        <Link href="/" aria-label="Nythera home" className="focus-ring mt-5 grid h-11 w-11 place-items-center rounded-full">
          <Image src="/icon.svg" alt="" width={34} height={34} className="h-8 w-8 object-contain" priority />
        </Link>

        <div className="my-5 h-px w-8 bg-[var(--codex-rule)]" />

        <nav aria-label="Primary navigation" className="flex flex-1 flex-col items-center gap-2">
          {primaryItems.map((item) => (
            <RailLink key={item.href} {...item} active={isActive(pathname, item.href)} />
          ))}
        </nav>

        <div className="mb-4 flex flex-col items-center gap-2">
          <ThemeToggle className="codex-rail-link h-11 w-11 rounded-none border-0 bg-transparent shadow-none" />
          <RailLink href="/settings" label="Settings" icon={GearSix} active={isActive(pathname, "/settings")} />
          {isAuthenticated ? (
            <button
              type="button"
              aria-label={`Sign out ${userLabel}`}
              title={`Sign out ${userLabel}`}
              onClick={() => void signOut({ callbackUrl: "/" })}
              className="codex-rail-link focus-ring grid h-11 w-11 place-items-center text-[var(--text-muted)] hover:text-[var(--codex-ivory)]"
            >
              <SignOut size={21} weight="thin" />
            </button>
          ) : (
            <RailLink href="/login" label="Sign in" icon={SignIn} active={isActive(pathname, "/login")} />
          )}
        </div>
      </aside>

      {!isCharacterStudio ? (
        <>
          <ThemeToggle className="mobile-theme-toggle fixed left-4 top-[calc(12px+env(safe-area-inset-top))] z-40 h-10 w-10 rounded-full border border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] shadow-soft md:hidden" />
          <Link
            href={isAuthenticated ? "/settings" : "/login"}
            aria-label={isAuthenticated ? userLabel : "Sign in"}
            className="mobile-account focus-ring fixed right-4 top-[calc(12px+env(safe-area-inset-top))] z-40 grid h-10 w-10 place-items-center rounded-full border border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] text-[var(--codex-ivory)] shadow-soft md:hidden"
          >
            <UserCircle size={22} weight="thin" />
          </Link>
        </>
      ) : null}

      <nav
        aria-label="Mobile primary navigation"
        className="codex-mobile-dock fixed inset-x-0 bottom-0 z-50 grid h-[calc(var(--codex-mobile-dock-height)+env(safe-area-inset-bottom))] grid-cols-5 border-t border-[var(--codex-rule)] bg-[var(--codex-paper)] px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {primaryItems.map((item) => (
          <MobileLink key={item.href} {...item} active={isActive(pathname, item.href)} />
        ))}
      </nav>
    </>
  );
}

type NavIcon = (typeof House);

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function RailLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: NavIcon; active: boolean }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "codex-rail-link focus-ring relative grid h-11 w-11 place-items-center text-[var(--text-muted)] no-underline",
        active && "is-active text-[var(--codex-mint)]"
      )}
    >
      <Icon size={22} weight={active ? "light" : "thin"} />
    </Link>
  );
}

function MobileLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: NavIcon; active: boolean }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "focus-ring flex min-w-0 flex-col items-center justify-center gap-0.5 text-[var(--text-muted)] no-underline",
        active && "text-[var(--codex-mint)]"
      )}
    >
      <Icon size={24} weight={active ? "light" : "thin"} />
      <span className={cn("max-w-full truncate text-[9px] uppercase tracking-[.14em]", !active && "sr-only")}>{label}</span>
    </Link>
  );
}
