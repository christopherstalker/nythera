"use client";

import Image from "next/image";
import { Download, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { usePwa } from "@/components/providers/pwa-provider";
import { Button } from "@/components/ui/button";

export function MobileInstallPrompt() {
  const {
    showMobilePrompt,
    hasNativeInstallPrompt,
    ios,
    iosGuideOpen,
    installMobile,
    dismissMobilePrompt,
    openIosGuide,
    closeIosGuide
  } = usePwa();

  if (!showMobilePrompt && !iosGuideOpen) {
    return null;
  }

  return (
    <>
      {showMobilePrompt ? (
        <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[65] px-3 md:hidden">
          <div className="relative overflow-hidden rounded-[28px] border border-primary/30 bg-[rgb(14_14_24/0.96)] p-4 shadow-[var(--shadow-card),0_0_40px_rgb(255_122_24/0.18)] backdrop-blur-2xl">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 hero-gradient opacity-50" />
            <button
              type="button"
              aria-label="Dismiss install prompt"
              className="focus-ring absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-[var(--text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--text-primary)]"
              onClick={dismissMobilePrompt}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative flex items-start gap-3 pr-8">
              <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-primary/25 bg-primary/10 shadow-[var(--shadow-glow-soft)]">
                <Image src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-[var(--text-primary)]">Install Nythera on your phone</p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  Full-screen chats, faster launch, and automatic updates — like a real app.
                </p>
              </div>
            </div>

            <div className="relative mt-4 grid gap-2">
              {hasNativeInstallPrompt ? (
                <Button type="button" className="h-12 w-full text-base" onClick={() => void installMobile()}>
                  <Download className="h-5 w-5" />
                  Install app
                </Button>
              ) : ios ? (
                <Button type="button" className="h-12 w-full text-base" onClick={openIosGuide}>
                  <Smartphone className="h-5 w-5" />
                  Add to Home Screen
                </Button>
              ) : null}
              <Button type="button" variant="ghost" className="h-10 w-full text-sm" onClick={dismissMobilePrompt}>
                Continue in browser
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {iosGuideOpen ? (
        <div className="fixed inset-0 z-[80] md:hidden">
          <button type="button" aria-label="Close install guide" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeIosGuide} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[32px] border border-white/[0.08] bg-[rgb(14_14_24/0.98)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-card)]">
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/15" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Add Nythera to Home Screen</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">On iPhone, install works through Safari:</p>
            <ol className="mt-4 space-y-3 text-sm text-[var(--text-primary)]">
              <li className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                <Share className="h-5 w-5 shrink-0 text-primary" />
                <span>
                  Tap <strong>Share</strong> at the bottom of Safari
                </span>
              </li>
              <li className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                <SquarePlus className="h-5 w-5 shrink-0 text-primary" />
                <span>
                  Choose <strong>Add to Home Screen</strong>
                </span>
              </li>
              <li className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                <Image src="/icons/icon-192.png" alt="" width={20} height={20} className="h-5 w-5 shrink-0 rounded-md" />
                <span>
                  Confirm <strong>Nythera</strong> and tap Add
                </span>
              </li>
            </ol>
            <Button type="button" className="mt-5 h-12 w-full" onClick={closeIosGuide}>
              Got it
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
