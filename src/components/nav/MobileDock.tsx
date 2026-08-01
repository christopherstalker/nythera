"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  isNavigationItemActive,
  primaryNavigationItems,
  type NavigationIcon
} from "@/components/nav/navigation-items";

export function MobileDock() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile primary navigation"
      className="codex-mobile-dock relative z-50 grid h-[calc(var(--codex-mobile-dock-height)+env(safe-area-inset-bottom))] w-full max-w-full shrink-0 grid-cols-5 border-t border-[var(--codex-rule)] bg-[var(--codex-paper)] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {primaryNavigationItems.map((item) => (
        <MobileLink
          key={item.href}
          {...item}
          active={isNavigationItemActive(pathname, item.href)}
        />
      ))}
    </nav>
  );
}

function MobileLink({
  href,
  label,
  icon: Icon,
  active
}: {
  href: string;
  label: string;
  icon: NavigationIcon;
  active: boolean;
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
      <Icon size={24} weight={active ? "light" : "thin"} />
      <span className={cn("max-w-full truncate text-[9px] uppercase tracking-[.12em]", !active && "sr-only")}>
        {label}
      </span>
    </Link>
  );
}
