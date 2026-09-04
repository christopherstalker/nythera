"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Mail } from "lucide-react";
import { AuthExperience } from "@/components/auth/auth-experience";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeCallbackPath } from "@/lib/auth-routes";
import { hasAuthenticatedSession } from "@/lib/auth-client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const callbackUrl = normalizeCallbackPath(searchParams.get("callbackUrl"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setError(null);
    setSubmitting(true);
    let result;
    try {
      result = await signIn("credentials", {
        email,
        password,
        callbackUrl,
        redirect: false
      });
    } catch {
      setError("Sign-in service is temporarily unavailable. Please try again.");
      setSubmitting(false);
      return;
    }

    if (!result) {
      setError("Sign-in service is temporarily unavailable. Please try again.");
      setSubmitting(false);
      return;
    }

    if (result.error) {
      setError("Invalid email or password.");
      setSubmitting(false);
      return;
    }

    if (!(await hasAuthenticatedSession())) {
      setError(
        "The account was verified, but this app could not save the session. Reopen Nythera from www.nythera.art and try again."
      );
      setSubmitting(false);
      return;
    }

    window.location.assign(normalizeCallbackPath(callbackUrl));
  }

  return (
    <AuthExperience
      mode="login"
      footer={
        <>
          Need an account?{" "}
          <Link href="/register" className="font-semibold text-primary no-underline hover:underline">
            Begin your chronicle
          </Link>
        </>
      }
    >
      <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">Sign in to Nythera</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        Your characters, memories, and worlds are waiting on the other side.
      </p>
      <OAuthButtons intent="login" callbackUrl={callbackUrl} />
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" autoComplete="email" required />
        <Input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          type="password"
          autoComplete="current-password"
          required
        />
        <div className="text-right">
          <Link href="/forgot-password" className="text-xs font-medium text-[var(--accent-mint)] no-underline hover:underline">
            Forgot password?
          </Link>
        </div>
        {error ? <p className="border-l border-destructive bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" type="submit" size="lg" disabled={submitting}>
          <Mail className="h-4 w-4" />
          {submitting ? "Opening your chronicle…" : "Enter the story"}
        </Button>
      </form>
    </AuthExperience>
  );
}
