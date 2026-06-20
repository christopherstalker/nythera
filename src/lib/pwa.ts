export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export const PWA_MOBILE_DISMISS_KEY = "nythera:pwa-mobile-install-dismissed";
export const PWA_SW_URL = "/sw.js";

export const NYTHERA_SITE_URL = "https://nythera-christopherstalkers-projects.vercel.app";

export function isStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isDesktopDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(min-width: 768px) and (pointer: fine)").matches;
}

export function isMobileDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  return !isDesktopDevice();
}

export function isIosDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isIosSafari() {
  if (!isIosDevice()) {
    return false;
  }

  const userAgent = navigator.userAgent;
  return /Safari/i.test(userAgent) && !/(CriOS|FxiOS|EdgiOS|OPiOS)/i.test(userAgent);
}

export function isAndroidDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android/i.test(navigator.userAgent);
}
