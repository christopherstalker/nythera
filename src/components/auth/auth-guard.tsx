"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { isProtectedPath, loginUrl } from "@/lib/auth-routes";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const requiresAuth = isProtectedPath(pathname);

  useEffect(() => {
    if (requiresAuth && status === "unauthenticated") {
      router.replace(loginUrl(pathname));
    }
  }, [pathname, requiresAuth, router, status]);

  if (requiresAuth && status !== "authenticated") {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center px-6">
        <div className="skeleton h-40 w-full max-w-md rounded-[var(--radius-xl)]" />
      </div>
    );
  }

  return children;
}
