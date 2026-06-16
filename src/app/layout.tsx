import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@/app/globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { SessionProvider } from "@/components/providers/session-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

const siteUrl = process.env.NEXTAUTH_URL ?? "https://nythera-christopherstalkers-projects.vercel.app";

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
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }]
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
        url: "/og-image.png",
        width: 1200,
        height: 1200,
        alt: "Nythera — AI Roleplay Platform"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Nythera",
    description: "AI roleplay platform with persona, memory, and secure model access.",
    images: ["/og-image.png"]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B0B12" },
    { media: "(prefers-color-scheme: light)", color: "#f5f6ff" }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen overflow-x-hidden`}>
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
