"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Mail } from "lucide-react";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell, Surface, SurfaceMuted } from "@/components/ui/page";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false
    });

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    window.location.href = "/explore";
  }

  return (
    <PageShell className="flex min-h-[calc(100dvh-68px)] items-center justify-center pb-5 sm:pb-6">
      <Surface className="relative isolate w-full max-w-md overflow-hidden p-7 sm:p-8">
        <div className="pointer-events-none absolute inset-0 -z-10 hero-gradient opacity-55" />
        <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-white/10 bg-primary/10 shadow-[var(--shadow-glow)]">
          <img src="/icon.svg" alt="" className="h-full w-full object-cover" />
        </div>
        <h1 className="mt-7 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Sign in to Velora</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Continue your characters, memories, chats, and model key settings.
        </p>
        <OAuthButtons intent="login" />
        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" autoComplete="email" required />
          <Input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            required
          />
          {error ? <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
          <Button className="w-full" type="submit">
            <Mail className="h-4 w-4" />
            Sign in
          </Button>
        </form>
        <SurfaceMuted className="mt-6 p-4 text-sm text-muted-foreground">
          Need an account?{" "}
          <Link href="/register" className="font-semibold text-primary">
            Create one
          </Link>
        </SurfaceMuted>
      </Surface>
    </PageShell>
  );
}
