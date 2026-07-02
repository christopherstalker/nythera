"use client";

import { RefreshCw } from "lucide-react";
import { usePwa } from "@/components/providers/pwa-provider";
import { Button } from "@/components/ui/button";

export function PwaUpdatePrompt() {
  const { updateReady, standalone, applyUpdate } = usePwa();

  if (!updateReady || !standalone) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-[70] -translate-x-1/2 px-3">
      <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-[var(--radius-pill)] border border-primary/25 bg-[var(--bg-surface)] px-4 py-2.5">
        <p className="text-sm text-[var(--text-primary)]">Nythera update ready</p>
        <Button type="button" size="sm" onClick={applyUpdate}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
