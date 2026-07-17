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
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/velora-aurora-v4-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/velora-aurora-v4-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/velora-aurora-v4-apple-180.png", sizes: "180x180", type: "image/png" }]
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
        url: "/og-image-v3.png",
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
    images: ["/og-image-v3.png"]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#03040F" },
    { media: "(prefers-color-scheme: light)", color: "#E5DCCB" }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${spaceGrotesk.className} ${spaceGrotesk.variable} min-h-screen overflow-hidden`}>
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
