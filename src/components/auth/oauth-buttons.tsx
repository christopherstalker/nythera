"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import type { OAuthProviderId } from "@/lib/oauth-providers";
import { cn } from "@/lib/utils";
import { normalizeCallbackPath } from "@/lib/auth-routes";

type OAuthButtonsProps = {
  intent: "login" | "register";
  callbackUrl?: string;
};

type ProviderConfig = {
  id: OAuthProviderId;
  label: string;
  shortLabel: string;
  registerLabel: string;
  className: string;
};

function ProviderIcon({ id }: { id: OAuthProviderId }) {
  if (id === "google") {
    return <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-xs font-bold text-[#1f1835]">G</span>;
  }

  if (id === "discord") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-[#5865F2]">
        <path d="M20.3 4.4A17.6 17.6 0 0 0 15.7 3c-.2.4-.5 1-.7 1.4a16.2 16.2 0 0 0-4.8 0C10 4 9.7 3.4 9.5 3a17.5 17.5 0 0 0-4.6 1.4C2.5 8.2 1.8 11.9 2.1 15.5a17.8 17.8 0 0 0 5.4 2.7c.4-.6.8-1.2 1.1-1.8-.6-.2-1.2-.5-1.7-.8.1-.1.2-.2.3-.2 3.3 1.5 6.9 1.5 10.1 0l.3.2c-.5.3-1.1.6-1.7.8.3.6.7 1.2 1.1 1.8a17.7 17.7 0 0 0 5.4-2.7c.5-4.2-.2-7.9-2.2-11.1ZM8.7 13.4c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
      </svg>
    );
  }

  if (id === "twitter") {
    return <span className="grid h-5 w-5 place-items-center text-sm font-bold text-white">𝕏</span>;
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

export function OAuthButtons({ intent, callbackUrl = "/explore" }: OAuthButtonsProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<OAuthProviderId | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProviders() {
      const response = await fetch("/api/auth/oauth-providers", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const body = await response.json().catch(() => null);
      if (active && Array.isArray(body?.providers)) {
        setProviders(body.providers);
      }
    }

    void loadProviders();
    return () => {
      active = false;
    };
  }, []);

  async function handleSignIn(provider: OAuthProviderId) {
    setLoadingProvider(provider);
    await signIn(provider, { callbackUrl: normalizeCallbackPath(callbackUrl) });
    setLoadingProvider(null);
  }

  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="flex items-stretch gap-2">
        {providers.map((provider) => {
          const label = intent === "register" ? provider.registerLabel : provider.label;
          const isLoading = loadingProvider === provider.id;

          return (
            <button
              key={provider.id}
              type="button"
              aria-label={isLoading ? `Opening ${provider.shortLabel}` : label}
              title={label}
              onClick={() => handleSignIn(provider.id)}
              disabled={loadingProvider !== null}
              className={cn(
                "focus-ring flex h-12 min-w-0 flex-1 items-center justify-center rounded-2xl border text-foreground transition-all duration-150 active:scale-[0.98] disabled:opacity-50",
                provider.className,
                isLoading && "ring-1 ring-primary/40"
              )}
            >
              {isLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
              ) : (
                <ProviderIcon id={provider.id} />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-center text-[11px] text-[var(--text-muted)]">{providers.map((p) => p.shortLabel).join(" · ")}</p>
      <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        <span className="h-px flex-1 bg-[var(--border-default)]" />
        <span>or inscribe by email</span>
        <span className="h-px flex-1 bg-[var(--border-default)]" />
      </div>
    </div>
  );
}
