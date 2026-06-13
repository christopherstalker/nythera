import type { Metadata, Viewport } from "next";
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
  description: "Free character chats with memory and bring-your-own model keys.",
  applicationName: "Velora",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Velora",
    statusBarStyle: "black-translucent"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B0B12" },
    { media: "(prefers-color-scheme: light)", color: "#F7F5FC" }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen overflow-x-hidden`}>
        <SessionProvider>
          <SiteNav />
          <main className="min-h-[calc(100dvh-4rem)]">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
