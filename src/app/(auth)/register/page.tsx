"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { UserPlus } from "lucide-react";
import { AuthExperience, TravelerNameSuggestions } from "@/components/auth/auth-experience";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <OAuthButtons intent="register" />
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" autoComplete="email" required />
        <div className="space-y-3">
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Traveler name"
            autoComplete="username"
            required
          />
          <TravelerNameSuggestions onSelect={setUsername} />
        </div>
        <Input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          type="password"
          autoComplete="new-password"
          required
        />
        {error ? <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" type="submit" size="lg">
          <UserPlus className="h-4 w-4" />
          Begin your chronicle
        </Button>
      </form>
    </AuthExperience>
  );
}
