"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { ShieldCheck, UserPlus } from "lucide-react";
import { AuthExperience, TravelerNameSuggestions } from "@/components/auth/auth-experience";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { UsernameField } from "@/components/profile/username-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasAuthenticatedSession } from "@/lib/auth-client";
import { normalizeUsername, usernameValidationMessage } from "@/lib/username";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [adultAcknowledged, setAdultAcknowledged] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const normalizedEmail = email.trim();
  const normalizedUsername = normalizeUsername(username);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const usernameValid = !usernameValidationMessage(normalizedUsername);
  const passwordValid = password.length >= 8 && password.length <= 128;
  const passwordsMatch = password === confirmPassword;
  const formValid = adultAcknowledged && emailValid && usernameValid && usernameAvailable === true && passwordValid && passwordsMatch;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    if (!formValid) {
      setError(passwordsMatch
        ? "Use a valid email, a 3–24 character traveler name, and a password of at least 8 characters."
        : "Passwords do not match.");
      return;
    }

    setError(null);
    setSubmitting(true);

    let response: Response;
    try {
      response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, username: normalizedUsername, password, adultAcknowledged, turnstileToken })
      });
    } catch {
      setError("Registration service is temporarily unavailable.");
      setSubmitting(false);
      return;
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Registration failed.");
      setSubmitting(false);
      return;
    }

    try {
      const result = await signIn("credentials", {
        email: normalizedEmail,
        password,
        callbackUrl: "/auth/new-user?callbackUrl=/explore",
        redirect: false
      });

      if (!result || result.error || !(await hasAuthenticatedSession())) {
        setError("Account created, but the session could not be saved. Sign in again.");
        setSubmitting(false);
        return;
      }

      window.location.assign("/auth/new-user?callbackUrl=/explore");
    } catch {
      setError("Account created, but sign-in is temporarily unavailable.");
      setSubmitting(false);
    }
  }

  return (
    <AuthExperience
      mode="register"
      footer={
        <>
          Already have a chronicle?{" "}
          <Link href="/login" className="font-semibold text-primary no-underline hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">Create your Nythera account</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        Choose a traveler name, claim your profile, and step into worlds built for roleplay.
      </p>
      <div className="mt-5 border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-mint)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Adults only — 18+</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
              Nythera is an adult-oriented roleplay platform and is not intended for children. You must confirm your age and accept the rules before chatting.
            </p>
          </div>
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs leading-5 text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={adultAcknowledged}
            onChange={(event) => setAdultAcknowledged(event.target.checked)}
            className="mt-1 accent-[var(--accent-mint)]"
            required
          />
          <span>
            I confirm I am 18 or older and agree to the <Link href="/terms" className="text-[var(--accent-mint)]">Terms</Link> and <Link href="/privacy" className="text-[var(--accent-mint)]">Privacy Policy</Link>.
          </span>
        </label>
      </div>
      <OAuthButtons intent="register" disabled={!adultAcknowledged} />
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" autoComplete="email" required aria-invalid={Boolean(email) && !emailValid} />
        <div className="space-y-3">
          <UsernameField id="registration-username" value={username} onChange={setUsername} onAvailabilityChange={setUsernameAvailable} />
          <TravelerNameSuggestions onSelect={setUsername} />
        </div>
        <Input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          aria-invalid={Boolean(password) && !passwordValid}
          required
        />
        <Input
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          aria-invalid={Boolean(confirmPassword) && !passwordsMatch}
          required
        />
        <p className="text-xs leading-5 text-[var(--text-muted)]">At least 8 characters.</p>
        <TurnstileWidget action="register" onTokenChange={setTurnstileToken} />
        {error ? <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" type="submit" size="lg" disabled={submitting || !formValid}>
          <UserPlus className="h-4 w-4" />
          {submitting ? "Creating your chronicle…" : "Begin your chronicle"}
        </Button>
      </form>
    </AuthExperience>
  );
}
