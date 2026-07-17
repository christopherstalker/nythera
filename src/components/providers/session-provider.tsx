import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { PwaProvider } from "@/components/providers/pwa-provider";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <PwaProvider>{children}</PwaProvider>
    </NextAuthSessionProvider>
  );
}
