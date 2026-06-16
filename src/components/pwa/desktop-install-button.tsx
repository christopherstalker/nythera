"use client";

import { Download } from "lucide-react";
import { usePwa } from "@/components/providers/pwa-provider";
import { cn } from "@/lib/utils";

type DesktopInstallButtonProps = {
  className?: string;
  collapsed?: boolean;
};

export function DesktopInstallButton({ className, collapsed = false }: DesktopInstallButtonProps) {
  const { canInstall, install, resetDismiss } = usePwa();

  if (!canInstall) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        resetDismiss();
        void install();
      }}
      className={cn(
        "nav-item w-full border border-primary/20 bg-primary/10 text-[var(--text-primary)] hover:border-primary/35 hover:bg-primary/16",
        className
      )}
      title="Install Nythera"
    >
      <Download className="h-5 w-5 shrink-0" />
      <span className={cn("min-w-0 truncate md:hidden lg:block", collapsed && "lg:hidden")}>Install app</span>
    </button>
  );
}
