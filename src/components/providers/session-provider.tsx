"use client";

import type { Session } from "next-auth";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { PwaProvider } from "@/components/providers/pwa-provider";
import { AppAppearanceProvider } from "@/components/providers/app-appearance-provider";
import type { AppAppearance } from "@/lib/app-appearance";

export function SessionProvider({
  children,
  session,
  initialAppearance
}: {
  children: React.ReactNode;
  session?: Session | null;
  initialAppearance?: AppAppearance | null;
}) {
  return (
    <NextAuthSessionProvider
      session={session}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
      refetchInterval={0}
    >
      <AppAppearanceProvider initialAppearance={initialAppearance} initialUserId={session?.user?.id}>
        <PwaProvider>{children}</PwaProvider>
      </AppAppearanceProvider>
    </NextAuthSessionProvider>
  );
}
