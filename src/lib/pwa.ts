export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export const PWA_DISMISS_KEY = "nythera:pwa-install-dismissed";
export const PWA_SW_URL = "/sw.js";

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

export function isDesktopInstallTarget() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(min-width: 768px) and (pointer: fine)").matches;
}

export function isMobileDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
}
