"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  SignIn,
  SignOut,
  UserCircle
} from "@phosphor-icons/react";
import { BRAND_ICON_SMALL } from "@/lib/brand";
import { cn } from "@/lib/utils";
import {
  isNavigationItemActive,
  primaryNavigationItems,
  utilityNavigationItems,
  type NavigationIcon
} from "@/components/nav/navigation-items";

export function NavRail() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const userLabel = session?.user?.name ?? session?.user?.email ?? "Account";
  const isCharacterStudio = pathname === "/create-character" || /^\/character\/[^/]+\/edit$/.test(pathname);

  return (
    <>
      <aside className="codex-rail fixed inset-y-0 left-0 z-50 hidden w-[var(--codex-rail-width)] flex-col items-center border-r border-[var(--codex-rule)] md:flex">
        <Link href="/" aria-label="Nythera home" className="focus-ring mt-5 grid h-11 w-11 place-items-center">
          <Image src={BRAND_ICON_SMALL} alt="" width={48} height={48} className="h-12 w-12 object-contain" priority />
        </Link>

        <div className="my-5 h-px w-8 bg-[var(--codex-rule)]" />

        <nav aria-label="Primary navigation" className="flex flex-1 flex-col items-center gap-2">
          {primaryNavigationItems.map((item) => (
            <RailLink key={item.href} {...item} active={isNavigationItemActive(pathname, item.href)} />
          ))}
        </nav>

        <div className="mb-4 flex flex-col items-center gap-2">
          {utilityNavigationItems.map((item) => (
            <RailLink key={item.href} {...item} active={isNavigationItemActive(pathname, item.href)} />
          ))}
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
            <RailLink href="/login" label="Sign in" icon={SignIn} active={isNavigationItemActive(pathname, "/login")} />
          )}
        </div>
      </aside>

      {!isCharacterStudio ? (
        <Link
          href={isAuthenticated ? "/settings" : "/login"}
          aria-label={isAuthenticated ? userLabel : "Sign in"}
          className="mobile-account focus-ring fixed right-4 top-[calc(12px+env(safe-area-inset-top))] z-40 grid h-10 w-10 place-items-center rounded-full border border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] text-[var(--codex-ivory)] shadow-soft md:hidden"
        >
          <UserCircle size={22} weight="thin" />
        </Link>
      ) : null}

    </>
  );
}

function RailLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: NavigationIcon; active: boolean }) {
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
