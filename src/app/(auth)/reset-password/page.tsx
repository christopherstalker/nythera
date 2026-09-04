"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AuthExperience } from "@/components/auth/auth-experience";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(
    token ? null : "The reset link is missing its token.",
  );
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setMessage("Passwords do not match.");
      return;
    }
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(body?.error ?? "Could not reset the password.");
      return;
    }
    setComplete(true);
    setMessage(null);
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
        Choose a new password
      </h2>
      {complete ? (
        <p className="mt-6 border-l border-emerald-400 bg-emerald-400/10 p-4 text-sm text-[var(--text-primary)]">
          Password changed. You can now sign in.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            minLength={8}
            maxLength={128}
            required
          />
          <Input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            minLength={8}
            maxLength={128}
            required
          />
          {message ? (
            <p className="border-l border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {message}
            </p>
          ) : null}
          <Button className="w-full" type="submit" size="lg" disabled={!token}>
            <KeyRound className="h-4 w-4" />
            Change password
          </Button>
        </form>
      )}
    </AuthExperience>
  );
}
