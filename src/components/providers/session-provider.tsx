"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { AppearanceProvider } from "@/components/providers/appearance-provider";
import { PwaProvider } from "@/components/providers/pwa-provider";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
        {children}
        <AppearanceProvider />
        <PwaProvider />
      </ThemeProvider>
    </NextAuthSessionProvider>
  );
}
