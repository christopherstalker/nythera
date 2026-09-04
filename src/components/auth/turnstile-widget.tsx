"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget({
  action,
  onTokenChange
}: {
  action: "register" | "adult_consent";
  onTokenChange: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [scriptFailed, setScriptFailed] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

  const renderWidget = useCallback(() => {
    if (widgetIdRef.current) {
      return true;
    }
    if (!siteKey || !containerRef.current || !window.turnstile) {
      return false;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      theme: "dark",
      size: "flexible",
      callback: (token: string) => onTokenChange(token),
      "expired-callback": () => onTokenChange(""),
      "error-callback": () => onTokenChange("")
    });
    return true;
  }, [action, onTokenChange, siteKey]);

  useEffect(() => {
    if (!renderWidget()) {
      retryTimerRef.current = setInterval(() => {
        if (renderWidget() && retryTimerRef.current) {
          clearInterval(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      }, 250);
    }

    return () => {
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget]);

  if (!siteKey) {
    return process.env.NODE_ENV === "development" ? (
      <p className="border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">
        Turnstile is bypassed in local development.
      </p>
    ) : null;
  }

  return (
    <div className="min-h-[65px] overflow-hidden" aria-label="Human verification">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => {
          setScriptFailed(false);
          renderWidget();
        }}
        onReady={() => {
          renderWidget();
        }}
        onError={() => setScriptFailed(true)}
      />
      <div ref={containerRef} className="w-full" />
      {scriptFailed ? (
        <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Human verification could not load. Check your connection or content blocker, then refresh the page.
        </p>
      ) : null}
    </div>
  );
}
