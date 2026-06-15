"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "nythera:pwa-install-dismissed";

export function PwaProvider() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch((error) => {
          console.warn("Nythera service worker registration failed.", error);
        });
      });
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const dismissed = localStorage.getItem(DISMISS_KEY) === "true";
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setVisible(!dismissed && !isStandalone());
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  async function install() {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") {
      setVisible(false);
      setInstallPrompt(null);
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed bottom-[calc(5.9rem+env(safe-area-inset-bottom))] left-3 z-[60] max-w-md rounded-[28px] border border-white/[0.07] bg-card/95 p-3 shadow-card-glow backdrop-blur-2xl lg:hidden"
      style={{ width: "min(366px, calc(100vw - 24px))" }}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 sm:gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inset">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Install Nythera</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Add the app to your phone for full-screen chats.</p>
        </div>
        <Button type="button" size="icon" onClick={install} aria-label="Install Nythera">
          <Download className="h-4 w-4" />
        </Button>
        <button
          type="button"
          aria-label="Dismiss install prompt"
          className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-white/[0.055] hover:text-foreground"
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}
