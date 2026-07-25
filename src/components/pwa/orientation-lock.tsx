"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "portrait-primary") => Promise<void>;
};

export function OrientationLock() {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");

    const isStandalone = () =>
      standaloneQuery.matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    const updateGuard = () => {
      const landscape = window.innerWidth > window.innerHeight;
      const phoneViewport = Math.min(window.innerWidth, window.innerHeight) <= 540;
      const touchDevice = coarsePointerQuery.matches || navigator.maxTouchPoints > 0;
      setBlocked(landscape && phoneViewport && touchDevice);
    };

    const requestPortraitLock = () => {
      if (!isStandalone()) {
        return;
      }

      const orientation = screen.orientation as LockableOrientation | undefined;
      if (!orientation?.lock) {
        return;
      }

      void orientation.lock("portrait-primary").catch(() => {
        // The strict phone guard remains available when the runtime denies the API lock.
      });
    };

    const refreshOrientation = () => {
      updateGuard();
      requestPortraitLock();
    };

    refreshOrientation();
    window.addEventListener("resize", updateGuard, { passive: true });
    window.addEventListener("orientationchange", refreshOrientation, { passive: true });
    window.addEventListener("pageshow", refreshOrientation);
    document.addEventListener("visibilitychange", refreshOrientation);

    return () => {
      window.removeEventListener("resize", updateGuard);
      window.removeEventListener("orientationchange", refreshOrientation);
      window.removeEventListener("pageshow", refreshOrientation);
      document.removeEventListener("visibilitychange", refreshOrientation);
    };
  }, []);

  return (
    <div
      data-portrait-guard="true"
      className={cn("portrait-guard fixed inset-0 z-[10000] place-items-center overflow-hidden bg-[var(--codex-paper)] px-8 text-center", blocked && "is-blocked")}
      role={blocked ? "alertdialog" : undefined}
      aria-modal={blocked ? "true" : undefined}
      aria-hidden={blocked ? undefined : "true"}
    >
      <div className="relative z-10 grid max-w-sm place-items-center">
        <div className="portrait-guard-book" aria-hidden="true">
          <span />
          <span />
        </div>
        <p className="codex-kicker mt-8 text-[var(--codex-mint)]">Portrait required</p>
        <h2 className="font-editorial mt-3 text-4xl leading-none text-[var(--codex-ivory)]">
          Return the Codex upright
        </h2>
        <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
          Nythera stays in portrait mode on phones. Turn your device vertically to continue.
        </p>
      </div>
      <div className="portrait-guard-veil absolute inset-0" aria-hidden="true" />
    </div>
  );
}
