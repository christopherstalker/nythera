import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
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
    apple: [{ url: "/icon.svg", sizes: "180x180", type: "image/svg+xml" }]
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
        url: "/icon.svg",
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
    images: ["/icon.svg"]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#03040F" },
    { media: "(prefers-color-scheme: light)", color: "#F0F3FC" }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${spaceGrotesk.className} ${spaceGrotesk.variable} min-h-screen overflow-x-hidden`}>
        <SessionProvider>
          <AppShell>{children}</AppShell>
        </SessionProvider>
      </body>
    </html>
  );
}
