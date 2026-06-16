"use client";

import { Download, Monitor, X } from "lucide-react";
import { usePwa } from "@/components/providers/pwa-provider";
import { Button } from "@/components/ui/button";

export function DesktopInstallPrompt() {
  const { showPrompt, install, dismissPrompt } = usePwa();

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[70] hidden md:block">
      <div className="pointer-events-auto w-[min(100vw-2rem,380px)] rounded-[var(--radius-xl)] border border-white/[0.08] bg-[rgb(14_14_24/0.94)] p-4 shadow-[var(--shadow-card)] backdrop-blur-2xl">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
            <Monitor className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Install Nythera on desktop</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              Open Nythera in its own window. Updates arrive automatically — no reinstall needed.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void install()}>
                <Download className="h-4 w-4" />
                Install app
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={dismissPrompt}>
                Not now
              </Button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss install prompt"
            className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--text-primary)]"
            onClick={dismissPrompt}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
