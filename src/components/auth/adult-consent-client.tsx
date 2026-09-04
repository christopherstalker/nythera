"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { AuthExperience } from "@/components/auth/auth-experience";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { Button } from "@/components/ui/button";

export function AdultConsentClient({ callbackPath }: { callbackPath: string }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acknowledged || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/adult-consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adultAcknowledged: acknowledged, turnstileToken })
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Could not record your confirmation.");
      }
      window.location.assign(callbackPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record your confirmation.");
      setSubmitting(false);
    }
  }

  return (
    <AuthExperience mode="register" footer="Your confirmation is recorded with the current Terms version.">
      <ShieldCheck className="h-8 w-8 text-[var(--accent-mint)]" />
      <h1 className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">Confirm adult access</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
        Nythera is an adult-oriented roleplay platform and is not intended for children. You must be 18 or older to chat.
      </p>
      <form onSubmit={accept} className="mt-6 grid gap-4">
        <label className="flex cursor-pointer items-start gap-3 border border-[var(--border-default)] bg-[var(--bg-input)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-1 accent-[var(--accent-mint)]"
            required
          />
          <span>
            I confirm I am 18 or older and agree to the <Link href="/terms" className="text-[var(--accent-mint)]">Terms</Link> and <Link href="/privacy" className="text-[var(--accent-mint)]">Privacy Policy</Link>.
          </span>
        </label>
        <TurnstileWidget action="adult_consent" onTokenChange={setTurnstileToken} />
        {error ? <p className="border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        <Button type="submit" size="lg" disabled={!acknowledged || submitting}>
          {submitting ? "Saving confirmation…" : "I am 18 — continue"}
        </Button>
      </form>
    </AuthExperience>
  );
}
