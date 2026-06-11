import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/app/globals.css";
import { SiteNav } from "@/components/layout/site-nav";
import { SessionProvider } from "@/components/providers/session-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

export const metadata: Metadata = {
  title: "Velora",
  description: "Free character chats with memory and bring-your-own model keys."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen`}>
        <SessionProvider>
          <SiteNav />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
