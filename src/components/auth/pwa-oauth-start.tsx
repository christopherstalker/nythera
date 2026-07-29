"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OAuthProviderId } from "@/lib/oauth-provider-ids";

export function PwaOAuthStart({
  provider,
  providerLabel,
  transactionId
}: {
  provider: OAuthProviderId;
  providerLabel: string;
  transactionId: string;
}) {
  const startedRef = useRef(false);
  const [failed, setFailed] = useState(false);

  const start = useCallback(async () => {
    setFailed(false);
    const callbackUrl = `/auth/pwa/complete?transactionId=${encodeURIComponent(transactionId)}`;

    try {
      await signIn(provider, { callbackUrl });
    } catch {
      setFailed(true);
    }
  }, [provider, transactionId]);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    void start();
  }, [start]);

  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
        Continue with {providerLabel}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        Complete the secure provider window, then return to the installed Nythera app.
      </p>
      {failed ? (
        <p className="mt-5 border-l border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          The provider window did not open. Try again.
        </p>
      ) : (
        <p className="mt-5 border-l border-[var(--accent-mint)] bg-white/[0.025] p-3 text-sm text-[var(--text-secondary)]">
          Opening the secure sign-in page…
        </p>
      )}
      <Button className="mt-5 w-full" type="button" size="lg" onClick={() => void start()}>
        <ExternalLink className="h-4 w-4" />
        Open {providerLabel}
      </Button>
    </div>
  );
}
