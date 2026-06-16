"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LogIn } from "lucide-react";
import { isGuestBrowsePath, loginUrl } from "@/lib/auth-routes";
import { Button } from "@/components/ui/button";

export function MobileGuestBar() {
  const pathname = usePathname();
  const { status } = useSession();

  if (status !== "unauthenticated" || !isGuestBrowsePath(pathname)) {
    return null;
  }

  return (
    <div className="sticky top-0 z-30 border-b border-primary/20 bg-[rgb(14_14_24/0.92)] px-4 py-2.5 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <p className="min-w-0 text-xs leading-5 text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--text-primary)]">Guest mode</span>
          <span className="hidden sm:inline"> — sign in to save chats and characters</span>
        </p>
        <Button asChild size="sm" className="shrink-0">
          <Link href={loginUrl(pathname)}>
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
        </Button>
      </div>
    </div>
  );
}
