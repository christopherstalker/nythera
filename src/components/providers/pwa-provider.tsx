"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DesktopInstallPrompt } from "@/components/pwa/desktop-install-prompt";
import { DesktopUpdatePrompt } from "@/components/pwa/desktop-update-prompt";
import {
  type BeforeInstallPromptEvent,
  PWA_DISMISS_KEY,
  PWA_SW_URL,
  isDesktopInstallTarget,
  isStandaloneDisplay
} from "@/lib/pwa";

type PwaContextValue = {
  canInstall: boolean;
  showPrompt: boolean;
  standalone: boolean;
  desktop: boolean;
  updateReady: boolean;
  install: () => Promise<boolean>;
  dismissPrompt: () => void;
  resetDismiss: () => void;
  applyUpdate: () => void;
};

const PwaContext = createContext<PwaContextValue | null>(null);

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(PWA_DISMISS_KEY) === "true");
    setStandalone(isStandaloneDisplay());
    setDesktop(isDesktopInstallTarget());

    const media = window.matchMedia("(min-width: 768px) and (pointer: fine)");
    const onMediaChange = () => setDesktop(media.matches);
    media.addEventListener("change", onMediaChange);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const onDisplayModeChange = () => setStandalone(isStandaloneDisplay());

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.matchMedia("(display-mode: standalone)").addEventListener("change", onDisplayModeChange);

    return () => {
      media.removeEventListener("change", onMediaChange);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.matchMedia("(display-mode: standalone)").removeEventListener("change", onDisplayModeChange);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register(PWA_SW_URL)
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          setUpdateReady(true);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) {
            return;
          }

          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          });
        });
      })
      .catch((error) => {
        console.warn("Nythera service worker registration failed.", error);
      });

    const onControllerChange = () => {
      setUpdateReady(false);
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) {
      return false;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice.catch(() => null);

    if (choice?.outcome === "accepted") {
      setInstallPrompt(null);
      setDismissed(true);
      localStorage.setItem(PWA_DISMISS_KEY, "true");
      return true;
    }

    return false;
  }, [installPrompt]);

  const dismissPrompt = useCallback(() => {
    localStorage.setItem(PWA_DISMISS_KEY, "true");
    setDismissed(true);
  }, []);

  const resetDismiss = useCallback(() => {
    localStorage.removeItem(PWA_DISMISS_KEY);
    setDismissed(false);
  }, []);

  const applyUpdate = useCallback(() => {
    navigator.serviceWorker.getRegistration().then((registration) => {
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    });
    window.location.reload();
  }, []);

  const canInstall = Boolean(installPrompt) && desktop && !standalone;
  const showPrompt = canInstall && !dismissed;

  const value = useMemo(
    () => ({
      canInstall,
      showPrompt,
      standalone,
      desktop,
      updateReady,
      install,
      dismissPrompt,
      resetDismiss,
      applyUpdate
    }),
    [applyUpdate, canInstall, desktop, dismissPrompt, install, resetDismiss, showPrompt, standalone, updateReady]
  );

  return (
    <PwaContext.Provider value={value}>
      {children}
      <DesktopInstallPrompt />
      <DesktopUpdatePrompt />
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error("usePwa must be used within PwaProvider.");
  }
  return context;
}
