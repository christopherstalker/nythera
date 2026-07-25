import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@/app/globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { SessionProvider } from "@/components/providers/session-provider";
import { OrientationLock } from "@/components/pwa/orientation-lock";
import { LivingCodexIntro } from "@/components/intro/living-codex-intro";
import { BRAND_ICON_APPLE, BRAND_ICON_LARGE, BRAND_ICON_SMALL, BRAND_OG_IMAGE, BRAND_THEME_COLOR } from "@/lib/brand";

const spaceGrotesk = localFont({
  src: "../assets/fonts/SpaceGrotesk-Variable.woff2",
  variable: "--font-space-grotesk",
  weight: "300 700",
  style: "normal",
  display: "swap",
  fallback: ["Segoe UI", "Roboto", "Arial", "sans-serif"]
});

const siteUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://nythera-ai-character-platform.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Nythera",
  description: "A cinematic AI character universe with persona, memory, and secure model access.",
  applicationName: "Nythera",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Nythera",
    statusBarStyle: "black-translucent"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [
      { url: BRAND_ICON_SMALL, sizes: "192x192", type: "image/png" },
      { url: BRAND_ICON_LARGE, sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: BRAND_ICON_APPLE, sizes: "180x180", type: "image/png" }]
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Nythera",
    title: "Nythera",
    description: "AI roleplay platform with persona, memory, and secure model access.",
    images: [
      {
        url: BRAND_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Nythera N logo"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Nythera",
    description: "AI roleplay platform with persona, memory, and secure model access.",
    images: [BRAND_OG_IMAGE]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: BRAND_THEME_COLOR
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${spaceGrotesk.className} ${spaceGrotesk.variable} min-h-screen overflow-hidden`}>
        <SessionProvider>
          <LivingCodexIntro />
          <OrientationLock />
          <AppShell>{children}</AppShell>
        </SessionProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
