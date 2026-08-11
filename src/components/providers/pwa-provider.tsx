"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MobileInstallPrompt } from "@/components/pwa/mobile-install-prompt";
import { PwaUpdatePrompt } from "@/components/pwa/pwa-update-prompt";
import {
  type BeforeInstallPromptEvent,
  PWA_MOBILE_DISMISS_KEY,
  PWA_SW_URL,
  isIosSafari,
  isMobileDevice,
  isStandaloneDisplay
} from "@/lib/pwa";

type PwaContextValue = {
  mobile: boolean;
  ios: boolean;
  standalone: boolean;
  canInstall: boolean;
  canInstallMobile: boolean;
  showMobilePrompt: boolean;
  hasNativeInstallPrompt: boolean;
  updateReady: boolean;
  installApp: () => Promise<boolean>;
  installMobile: () => Promise<boolean>;
  dismissMobilePrompt: () => void;
  openIosGuide: () => void;
  iosGuideOpen: boolean;
  closeIosGuide: () => void;
  applyUpdate: () => void;
};

const PwaContext = createContext<PwaContextValue | null>(null);

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [standalone, setStandalone] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [ios, setIos] = useState(false);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const reloadOnControllerChangeRef = useRef(false);
  const controllerReloadedRef = useRef(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(PWA_MOBILE_DISMISS_KEY) === "true");
    setStandalone(isStandaloneDisplay());
    setMobile(isMobileDevice());
    setIos(isIosSafari());

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

    reloadOnControllerChangeRef.current = Boolean(navigator.serviceWorker.controller);
    let registration: ServiceWorkerRegistration | null = null;

    const checkForUpdate = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void registration?.update().catch((error) => {
        console.warn("Nythera service worker update check failed.", error);
      });
    };

    async function registerServiceWorker() {
      try {
        const activeRegistration = await navigator.serviceWorker.register(PWA_SW_URL, {
          updateViaCache: "none"
        });
        registration = activeRegistration;

        if (activeRegistration.waiting && navigator.serviceWorker.controller) {
          setUpdateReady(true);
        }

        activeRegistration.addEventListener("updatefound", () => {
          const installing = activeRegistration.installing;
          if (!installing) {
            return;
          }

          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          });
        });
        checkForUpdate();
      } catch (error) {
        console.warn("Nythera service worker registration failed.", error);
      }
    }

    void registerServiceWorker();

    const onControllerChange = () => {
      setUpdateReady(false);

      if (reloadOnControllerChangeRef.current && !controllerReloadedRef.current) {
        controllerReloadedRef.current = true;
        window.location.reload();
        return;
      }

      reloadOnControllerChangeRef.current = true;
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("pageshow", checkForUpdate);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.removeEventListener("pageshow", checkForUpdate);
    };
  }, []);

  const installApp = useCallback(async () => {
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

  const installMobile = installApp;

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

  const applyUpdate = useCallback(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    reloadOnControllerChangeRef.current = true;
    registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
  }, []);

  const hasNativeInstallPrompt = Boolean(installPrompt);
  const canInstall = !standalone && (hasNativeInstallPrompt || ios);
  const canInstallMobile = mobile && canInstall;
  const showMobilePrompt = pathname.startsWith("/download") && canInstallMobile && !dismissed;

  const value = useMemo(
    () => ({
      mobile,
      ios,
      standalone,
      canInstall,
      canInstallMobile,
      showMobilePrompt,
      hasNativeInstallPrompt,
      updateReady,
      installApp,
      installMobile,
      dismissMobilePrompt,
      openIosGuide,
      iosGuideOpen,
      closeIosGuide,
      applyUpdate
    }),
    [
      applyUpdate,
      canInstall,
      canInstallMobile,
      closeIosGuide,
      dismissMobilePrompt,
      hasNativeInstallPrompt,
      installApp,
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
