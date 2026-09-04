"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { AuthExperience } from "@/components/auth/auth-experience";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Could not request a reset link.");
      return;
    }
    setSent(true);
  }

  return (
    <AuthExperience
      mode="login"
      footer={
        <Link
          href="/login"
          className="font-semibold text-primary no-underline hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
        Reset your password
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        Enter your account email. If it exists, we will send a link valid for 30
        minutes.
      </p>
      {sent ? (
        <p className="mt-6 border-l border-emerald-400 bg-emerald-400/10 p-4 text-sm text-[var(--text-primary)]">
          Check your inbox for the reset link.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            placeholder="Email"
            required
          />
          {error ? (
            <p className="border-l border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button className="w-full" type="submit" size="lg">
            <Mail className="h-4 w-4" />
            Send reset link
          </Button>
        </form>
      )}
    </AuthExperience>
  );
}
