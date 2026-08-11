"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  isNavigationItemActive,
  primaryNavigationItems,
  type NavigationIcon
} from "@/components/nav/navigation-items";

export function MobileDock() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <nav
      aria-label="Mobile primary navigation"
      className="codex-mobile-dock fixed inset-x-0 bottom-0 z-[80] grid h-[calc(var(--codex-mobile-dock-height)+env(safe-area-inset-bottom))] w-full max-w-full grid-cols-5 border-t border-[var(--codex-rule)] bg-[var(--codex-paper)] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {primaryNavigationItems.map((item) => (
        <MobileLink
          key={item.href}
          {...item}
          active={isNavigationItemActive(pathname, item.href) || (item.href === "/account" && pathname.startsWith("/settings"))}
          accountImage={item.href === "/account" ? session?.user?.image : undefined}
          accountName={item.href === "/account" ? session?.user?.name ?? session?.user?.username : undefined}
        />
      ))}
    </nav>
  );
}

function MobileLink({
  href,
  label,
  icon: Icon,
  active,
  accountImage,
  accountName
}: {
  href: string;
  label: string;
  icon: NavigationIcon;
  active: boolean;
  accountImage?: string | null;
  accountName?: string | null;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "focus-ring flex min-w-0 flex-col items-center justify-center gap-0.5 text-[var(--text-muted)] no-underline",
        active && "text-[var(--codex-mint)]"
      )}
    >
      {href === "/account" && accountImage ? (
        <Avatar name={accountName ?? "Account"} src={accountImage} size="sm" className={cn("h-7 w-7 border", active ? "border-[var(--codex-mint)]" : "border-[var(--codex-rule)]")} />
      ) : (
        <Icon size={24} weight={active ? "light" : "thin"} />
      )}
      <span className={cn("max-w-full truncate text-[9px] uppercase tracking-[.12em]", !active && "sr-only")}>
        {label}
      </span>
    </Link>
  );
}
