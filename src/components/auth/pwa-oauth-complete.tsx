"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  clearStoredPwaAuthTransaction,
  hasAuthenticatedSession,
  readStoredPwaAuthTransaction
} from "@/lib/auth-client";

type CompletionState = "binding" | "ready" | "failed";

export function PwaOAuthComplete({ transactionId }: { transactionId: string }) {
  const completedRef = useRef(false);
  const [state, setState] = useState<CompletionState>("binding");

  const complete = useCallback(async () => {
    setState("binding");
    try {
      const response = await fetch(
        `/api/auth/pwa/transactions/${encodeURIComponent(transactionId)}/complete`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: "{}"
        }
      );
      if (!response.ok) {
        setState("failed");
        return;
      }

      const stored = readStoredPwaAuthTransaction();
      if (
        stored?.transactionId === transactionId &&
        (await hasAuthenticatedSession())
      ) {
        clearStoredPwaAuthTransaction();
        window.location.assign(stored.callbackPath);
        return;
      }

      setState("ready");
    } catch {
      setState("failed");
    }
  }, [transactionId]);

  useEffect(() => {
    if (completedRef.current) {
      return;
    }
    completedRef.current = true;
    void complete();
  }, [complete]);

  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
        {state === "ready" ? "Sign-in approved" : "Finishing secure sign-in"}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        {state === "ready"
          ? "Return to the installed Nythera app. It will finish the session automatically."
          : "Nythera is securely connecting this provider session to the installed app."}
      </p>

      {state === "ready" ? (
        <div className="mt-5 flex items-center gap-3 border-l border-[var(--accent-mint)] bg-white/[0.025] p-4 text-sm text-[var(--text-secondary)]">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--accent-mint)]" />
          You can safely close this window.
        </div>
      ) : null}

      {state === "failed" ? (
        <div className="mt-5 border-l border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          This sign-in request expired or could not be verified.
        </div>
      ) : null}

      <div className="mt-5 grid gap-2">
        {state === "failed" ? (
          <Button type="button" size="lg" onClick={() => void complete()}>
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
        ) : null}
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={() => window.close()}
        >
          <X className="h-4 w-4" />
          Close window
        </Button>
        <Button asChild type="button" variant="ghost">
          <Link href="/">Open Nythera in this browser</Link>
        </Button>
      </div>
    </div>
  );
}
