"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MobileInstallPrompt } from "@/components/pwa/mobile-install-prompt";
import { PwaUpdatePrompt } from "@/components/pwa/pwa-update-prompt";
import {
  type BeforeInstallPromptEvent,
  PWA_MOBILE_DISMISS_KEY,
  PWA_SW_URL,
  isIosDevice,
  isMobileDevice,
  isStandaloneDisplay
} from "@/lib/pwa";

type PwaContextValue = {
  mobile: boolean;
  ios: boolean;
  standalone: boolean;
  canInstallMobile: boolean;
  showMobilePrompt: boolean;
  hasNativeInstallPrompt: boolean;
  updateReady: boolean;
  installMobile: () => Promise<boolean>;
  dismissMobilePrompt: () => void;
  openIosGuide: () => void;
  iosGuideOpen: boolean;
  closeIosGuide: () => void;
  applyUpdate: () => void;
};

const PwaContext = createContext<PwaContextValue | null>(null);

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [ios, setIos] = useState(false);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(PWA_MOBILE_DISMISS_KEY) === "true");
    setStandalone(isStandaloneDisplay());
    setMobile(isMobileDevice());
    setIos(isIosDevice());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const onDisplayModeChange = () => setStandalone(isStandaloneDisplay());
    const onResize = () => setMobile(isMobileDevice());

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("resize", onResize);
    window.matchMedia("(display-mode: standalone)").addEventListener("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("resize", onResize);
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

    const onControllerChange = () => setUpdateReady(false);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  const installMobile = useCallback(async () => {
    if (!installPrompt) {
      return false;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice.catch(() => null);

    if (choice?.outcome === "accepted") {
      setInstallPrompt(null);
      setDismissed(true);
      localStorage.setItem(PWA_MOBILE_DISMISS_KEY, "true");
      return true;
    }

    return false;
  }, [installPrompt]);

  const dismissMobilePrompt = useCallback(() => {
    localStorage.setItem(PWA_MOBILE_DISMISS_KEY, "true");
    setDismissed(true);
    setIosGuideOpen(false);
  }, []);

  const openIosGuide = useCallback(() => {
    setIosGuideOpen(true);
  }, []);

  const closeIosGuide = useCallback(() => {
    setIosGuideOpen(false);
  }, []);

  const applyUpdate = useCallback(() => {
    navigator.serviceWorker.getRegistration().then((registration) => {
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    });
    window.location.reload();
  }, []);

  const hasNativeInstallPrompt = Boolean(installPrompt);
  const canInstallMobile = mobile && !standalone && (hasNativeInstallPrompt || ios);
  const showMobilePrompt = canInstallMobile && !dismissed;

  const value = useMemo(
    () => ({
      mobile,
      ios,
      standalone,
      canInstallMobile,
      showMobilePrompt,
      hasNativeInstallPrompt,
      updateReady,
      installMobile,
      dismissMobilePrompt,
      openIosGuide,
      iosGuideOpen,
      closeIosGuide,
      applyUpdate
    }),
    [
      applyUpdate,
      canInstallMobile,
      closeIosGuide,
      dismissMobilePrompt,
      hasNativeInstallPrompt,
      installMobile,
      ios,
      iosGuideOpen,
      mobile,
      openIosGuide,
      showMobilePrompt,
      standalone,
      updateReady
    ]
  );

  return (
    <PwaContext.Provider value={value}>
      {children}
      <MobileInstallPrompt />
      <PwaUpdatePrompt />
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
