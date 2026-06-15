"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { UserPlus } from "lucide-react";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell, Surface, SurfaceMuted } from "@/components/ui/page";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, username, password })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Registration failed.");
      return;
    }

    await signIn("credentials", {
      email,
      password,
      callbackUrl: "/explore"
    });
  }

  return (
    <PageShell className="flex min-h-[calc(100dvh-68px)] items-center justify-center pb-5 sm:pb-6">
      <Surface className="relative isolate w-full max-w-md overflow-hidden p-7 sm:p-8">
        <div className="pointer-events-none absolute inset-0 -z-10 hero-gradient opacity-55" />
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Create your Nythera account</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Save characters, resume chats, and add provider keys when you want live models.
        </p>
        <OAuthButtons intent="register" />
        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" autoComplete="email" required />
          <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" autoComplete="username" required />
          <Input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="new-password"
            required
          />
          {error ? <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" type="submit">
            <UserPlus className="h-4 w-4" />
            Register
          </Button>
        </form>
        <SurfaceMuted className="mt-6 p-4 text-sm text-muted-foreground">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-primary">
            Sign in
          </Link>
        </SurfaceMuted>
      </Surface>
    </PageShell>
  );
}
