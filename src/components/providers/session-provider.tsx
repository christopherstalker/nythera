"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { PwaProvider } from "@/components/providers/pwa-provider";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
        {children}
        <PwaProvider />
      </ThemeProvider>
    </NextAuthSessionProvider>
  );
}
