"use client";

import Link from "next/link";
import { Download, Monitor, Smartphone } from "lucide-react";
import { usePwa } from "@/components/providers/pwa-provider";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell, Surface } from "@/components/ui/page";

const WINDOWS_INSTALLER = "/downloads/Nythera-Setup.exe";

export default function DownloadPage() {
  const { canInstallMobile, hasNativeInstallPrompt, installMobile, openIosGuide, ios, dismissMobilePrompt } = usePwa();

  return (
    <PageShell className="space-y-6">
      <PageHeader
        icon={Download}
        title="Get Nythera"
        description="Install Nythera on your phone as a PWA, or download the desktop app for Windows."
      />

      <Surface className="relative overflow-hidden p-5 sm:p-6 md:hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hero-gradient opacity-45" />
        <div className="relative flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
            <Smartphone className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Phone app (PWA)</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              Add Nythera to your home screen for full-screen chats. Updates happen automatically in the background.
            </p>
            {canInstallMobile ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {hasNativeInstallPrompt ? (
                  <Button type="button" onClick={() => void installMobile()}>
                    <Download className="h-4 w-4" />
                    Install on this device
                  </Button>
                ) : ios ? (
                  <Button type="button" onClick={openIosGuide}>
                    <Smartphone className="h-4 w-4" />
                    Add to Home Screen
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" onClick={dismissMobilePrompt}>
                  Dismiss
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--text-muted)]">Already installed or not available in this browser.</p>
            )}
          </div>
        </div>
      </Surface>

      <Surface className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
            <Monitor className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Windows</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              Native desktop app (.exe installer). Loads the live Nythera site — updates without reinstalling.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild>
                <a href={WINDOWS_INSTALLER} download>
                  <Download className="h-4 w-4" />
                  Download for Windows
                </a>
              </Button>
            </div>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Build locally: <code className="rounded bg-white/5 px-1.5 py-0.5">npm run desktop:build:win</code>
            </p>
          </div>
        </div>
      </Surface>

      <Surface className="hidden p-5 sm:p-6 md:block">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Mobile install</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          On your phone, open{" "}
          <Link href="/" className="font-medium text-primary no-underline hover:underline">
            nythera.app
          </Link>{" "}
          in Chrome (Android) or Safari (iPhone) and use the install banner or Add to Home Screen.
        </p>
      </Surface>
    </PageShell>
  );
}
