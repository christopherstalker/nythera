"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  Download,
  Globe2,
  MonitorSmartphone,
  RefreshCw,
  Share,
  Smartphone,
  SquarePlus,
  WifiOff,
  type LucideIcon
} from "lucide-react";
import { usePwa } from "@/components/providers/pwa-provider";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell, Surface } from "@/components/ui/page";

const installBenefits = [
  {
    icon: Download,
    title: "One app on every device",
    text: "Install from Chrome or Edge on Windows, Android, tablets, and supported desktop browsers."
  },
  {
    icon: RefreshCw,
    title: "Updates without installers",
    text: "New UI, persona switching, filters, and fixes arrive through the web app automatically."
  },
  {
    icon: Globe2,
    title: "Synced account state",
    text: "Theme color, personas, chats, memory, ratings, and library data follow the same account."
  },
  {
    icon: WifiOff,
    title: "Offline app shell",
    text: "The installed app opens cleanly offline and reconnects when the network returns."
  }
];

export default function DownloadPage() {
  const { canInstall, hasNativeInstallPrompt, standalone, ios, installApp, openIosGuide } = usePwa();

  return (
    <PageShell className="space-y-6">
      <Surface className="relative isolate overflow-hidden p-5 sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 hero-gradient opacity-55" />
        <PageHeader
          icon={MonitorSmartphone}
          title="Install Nythera"
          description="Nythera is delivered as a PWA: one installable app for desktop, phones, and tablets without Windows .exe warnings."
          actions={
            hasNativeInstallPrompt && canInstall ? (
              <Button type="button" size="lg" onClick={() => void installApp()}>
                <Download className="h-4 w-4" />
                Install app
              </Button>
            ) : ios && canInstall ? (
              <Button type="button" size="lg" onClick={openIosGuide}>
                <Smartphone className="h-4 w-4" />
                Add to Home Screen
              </Button>
            ) : standalone ? (
              <span className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-pill)] border border-[rgb(var(--accent-rgb)_/_0.25)] bg-[var(--accent-purple-soft)] px-4 text-sm font-semibold text-[var(--text-primary)]">
                <CheckCircle2 className="h-4 w-4" />
                Installed
              </span>
            ) : null
          }
        />
      </Surface>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <Surface className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-primary/25 bg-primary/10 shadow-[var(--shadow-glow-soft)]">
              <Image src="/icons/velora-aurora-v4-192.png" alt="" width={42} height={42} className="h-10 w-10" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recommended install</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Open Nythera in Chrome or Edge and press the install button. It launches like a desktop app, keeps the mobile layout responsive, and avoids unsigned installer warnings.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {hasNativeInstallPrompt && canInstall ? (
                  <Button type="button" onClick={() => void installApp()}>
                    <Download className="h-4 w-4" />
                    Install on this device
                  </Button>
                ) : ios && canInstall ? (
                  <Button type="button" onClick={openIosGuide}>
                    <Smartphone className="h-4 w-4" />
                    Add to Home Screen
                  </Button>
                ) : standalone ? (
                  <Button asChild variant="secondary">
                    <Link href="/explore">Open Nythera</Link>
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/">Open Nythera</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Surface>

        <Surface className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Manual install</h2>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-[var(--text-secondary)]">
            <InstallRow icon={MonitorSmartphone} title="Windows / desktop">
              Use Chrome or Edge, open the browser menu, then choose <strong>Install Nythera</strong> or <strong>Apps / Install this site as an app</strong>.
            </InstallRow>
            <InstallRow icon={Smartphone} title="Android">
              Open in Chrome and tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
            </InstallRow>
            <InstallRow icon={Share} title="iPhone / iPad">
              Open in Safari, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.
            </InstallRow>
          </div>
        </Surface>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {installBenefits.map((step) => {
          const Icon = step.icon;
          return (
            <Surface key={step.title} className="p-4">
              <div className="grid h-10 w-10 place-items-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--accent-purple-soft)] text-[var(--accent-purple)]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-[var(--text-primary)]">{step.title}</h3>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{step.text}</p>
            </Surface>
          );
        })}
      </div>

      <Surface className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <SquarePlus className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-purple)]" />
          <p className="text-sm leading-6 text-[var(--text-secondary)]">
            The Windows .exe build is no longer the primary release path. PWA install is the default because it avoids code-signing warnings and keeps every device on the same live app.
          </p>
        </div>
      </Surface>
    </PageShell>
  );
}

function InstallRow({
  icon: Icon,
  title,
  children
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-input)] p-3 shadow-[var(--glass-highlight)]">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
        <Icon className="h-4 w-4 text-[var(--accent-purple)]" />
        {title}
      </div>
      <p>{children}</p>
    </div>
  );
}
