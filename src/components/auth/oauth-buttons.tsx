"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { Apple } from "lucide-react";
import {
  OAUTH_PROVIDER_IDS,
  type OAuthProviderId
} from "@/lib/oauth-provider-ids";
import { cn } from "@/lib/utils";
import { normalizeCallbackPath } from "@/lib/auth-routes";
import {
  clearStoredPwaAuthTransaction,
  hasAuthenticatedSession,
  readStoredPwaAuthTransaction,
  storePwaAuthTransaction,
  type StoredPwaAuthTransaction
} from "@/lib/auth-client";
import { usePwa } from "@/components/providers/pwa-provider";

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

const AUTH_START_TIMEOUT_MS = 15_000;

async function withTimeout<T>(operation: Promise<T>, message: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), AUTH_START_TIMEOUT_MS);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}

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

  if (id === "apple") {
    return <Apple aria-hidden="true" className="h-5 w-5 text-white" />;
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
  const { standalone } = usePwa();
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<OAuthProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualStartUrl, setManualStartUrl] = useState<string | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);

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

  const finishPwaSignIn = useCallback(async (transaction: StoredPwaAuthTransaction) => {
    const result = await withTimeout(
      signIn("pwa-handoff", {
        transactionId: transaction.transactionId,
        nonce: transaction.nonce,
        callbackUrl: transaction.callbackPath,
        redirect: false
      }),
      "Session handoff timed out."
    );
    const authenticated = await withTimeout(
      hasAuthenticatedSession(),
      "Session verification timed out."
    );

    if (!result || result.error || !authenticated) {
      throw new Error("Session cookie was not created.");
    }

    clearStoredPwaAuthTransaction();
    window.location.assign(transaction.callbackPath);
  }, []);

  const pollPwaTransaction = useCallback(
    async (transaction: StoredPwaAuthTransaction) => {
      pollAbortRef.current?.abort();
      const controller = new AbortController();
      pollAbortRef.current = controller;

      while (!controller.signal.aborted && Date.now() < transaction.expiresAt) {
        let response: Response;
        const requestController = new AbortController();
        const abortRequest = () => requestController.abort();
        const timeoutId = window.setTimeout(abortRequest, AUTH_START_TIMEOUT_MS);
        controller.signal.addEventListener("abort", abortRequest, { once: true });
        try {
          response = await fetch(
            `/api/auth/pwa/transactions/${encodeURIComponent(transaction.transactionId)}/status`,
            {
              method: "POST",
              headers: {
                "content-type": "application/json"
              },
              body: JSON.stringify({ nonce: transaction.nonce }),
              signal: requestController.signal
            }
          );
        } catch {
          if (controller.signal.aborted) {
            return;
          }
          throw new Error("Could not reach the sign-in service.");
        } finally {
          window.clearTimeout(timeoutId);
          controller.signal.removeEventListener("abort", abortRequest);
        }

        if (response.status === 410) {
          break;
        }
        if (!response.ok) {
          throw new Error("Secure sign-in status could not be verified.");
        }

        const body = await response.json().catch(() => null);
        if (body?.status === "ready") {
          await finishPwaSignIn(transaction);
          return;
        }
        if (body?.status === "expired") {
          break;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }

      if (!controller.signal.aborted) {
        clearStoredPwaAuthTransaction();
        setManualStartUrl(null);
        setLoadingProvider(null);
        setError("The secure sign-in request expired. Start again.");
      }
    },
    [finishPwaSignIn]
  );

  useEffect(() => {
    if (!standalone) {
      return;
    }

    const stored = readStoredPwaAuthTransaction();
    if (
      !stored ||
      !OAUTH_PROVIDER_IDS.includes(stored.provider as OAuthProviderId)
    ) {
      return;
    }

    setLoadingProvider(stored.provider as OAuthProviderId);
    setManualStartUrl(
      `/auth/pwa/start?transactionId=${encodeURIComponent(stored.transactionId)}`
    );
    void pollPwaTransaction(stored).catch(() => {
      clearStoredPwaAuthTransaction();
      setLoadingProvider(null);
      setError("Secure sign-in could not be completed. Try again.");
    });

    return () => pollAbortRef.current?.abort();
  }, [pollPwaTransaction, standalone]);

  async function handleSignIn(provider: OAuthProviderId) {
    setLoadingProvider(provider);
    setError(null);
    setManualStartUrl(null);

    if (!standalone) {
      try {
        const result = await withTimeout(
          signIn(provider, {
            callbackUrl: normalizeCallbackPath(callbackUrl),
            redirect: false
          }),
          "Provider sign-in timed out."
        );
        if (!result || result.error || !result.url) {
          throw new Error("Provider sign-in could not start.");
        }
        window.location.assign(result.url);
      } catch {
        setError("The provider sign-in page could not be opened.");
        setLoadingProvider(null);
      }
      return;
    }

    let popup: Window | null = null;
    try {
      popup = window.open(
        "/auth/pwa/preparing",
        "nythera-pwa-auth",
        "popup,width=520,height=760"
      );
      if (popup) {
        try {
          popup.opener = null;
        } catch {
          try {
            popup.close();
          } catch {
            // The browser may revoke access to a newly opened window.
          }
          popup = null;
        }
      }
    } catch {
      popup = null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        AUTH_START_TIMEOUT_MS
      );
      let response: Response;
      try {
        response = await fetch("/api/auth/pwa/transactions", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            provider,
            callbackUrl: normalizeCallbackPath(callbackUrl)
          }),
          signal: controller.signal
        });
      } finally {
        window.clearTimeout(timeoutId);
      }
      const body = await response.json().catch(() => null);
      const expiresIn = Number(body?.expiresIn);
      const expiresAt = Number(body?.expiresAt);
      if (
        !response.ok ||
        !body?.transactionId ||
        !body?.nonce ||
        !body?.startUrl ||
        !Number.isFinite(expiresIn) ||
        expiresIn <= 0 ||
        expiresIn > 300 ||
        !Number.isFinite(expiresAt) ||
        expiresAt <= 0
      ) {
        throw new Error("Transaction creation failed.");
      }

      const transaction: StoredPwaAuthTransaction = {
        transactionId: body.transactionId,
        nonce: body.nonce,
        callbackPath: normalizeCallbackPath(body.callbackPath),
        provider,
        expiresAt
      };
      storePwaAuthTransaction(transaction);
      setManualStartUrl(body.startUrl);

      let providerWindowOpened = false;
      if (popup && !popup.closed) {
        try {
          popup.location.replace(body.startUrl);
          providerWindowOpened = true;
        } catch {
          try {
            popup.close();
          } catch {
            // The browser may revoke access before navigation completes.
          }
          popup = null;
        }
      }

      if (!providerWindowOpened) {
        window.location.assign(body.startUrl);
        return;
      }

      await pollPwaTransaction(transaction);
    } catch {
      try {
        popup?.close();
      } catch {
        // The provider window may already be outside this page's origin.
      }
      clearStoredPwaAuthTransaction();
      setManualStartUrl(null);
      setLoadingProvider(null);
      setError("Secure PWA sign-in could not start. Try again.");
    }
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
      {manualStartUrl ? (
        <a
          href={manualStartUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring block border border-[var(--accent-mint)]/35 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-mint)] no-underline"
        >
          Open secure provider window
        </a>
      ) : null}
      {error ? (
        <p className="border-l border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <p className="text-center text-[11px] text-[var(--text-muted)]">{providers.map((p) => p.shortLabel).join(" · ")}</p>
      <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        <span className="h-px flex-1 bg-[var(--border-default)]" />
        <span>or inscribe by email</span>
        <span className="h-px flex-1 bg-[var(--border-default)]" />
      </div>
    </div>
  );
}
