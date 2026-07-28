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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
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
      return;
    }

    if (!result) {
      setError("Sign-in service is temporarily unavailable. Please try again.");
      return;
    }

    if (result.error) {
      setError("Invalid email or password.");
      return;
    }

    window.location.href = normalizeCallbackPath(callbackUrl);
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
        {error ? <p className="border-l border-destructive bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" type="submit" size="lg">
          <Mail className="h-4 w-4" />
          Enter the story
        </Button>
      </form>
    </AuthExperience>
  );
}
