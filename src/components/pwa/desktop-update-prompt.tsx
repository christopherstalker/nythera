"use client";

import { RefreshCw } from "lucide-react";
import { usePwa } from "@/components/providers/pwa-provider";
import { Button } from "@/components/ui/button";

export function DesktopUpdatePrompt() {
  const { updateReady, desktop, applyUpdate } = usePwa();

  if (!updateReady || !desktop) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-[70] hidden -translate-x-1/2 md:block">
      <div className="pointer-events-auto flex items-center gap-3 rounded-[var(--radius-pill)] border border-primary/25 bg-[rgb(14_14_24/0.94)] px-4 py-2.5 shadow-[var(--shadow-glow)] backdrop-blur-2xl">
        <p className="text-sm text-[var(--text-primary)]">A new version of Nythera is ready.</p>
        <Button type="button" size="sm" onClick={applyUpdate}>
          <RefreshCw className="h-4 w-4" />
          Update now
        </Button>
      </div>
    </div>
  );
}
