"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { UserPlus } from "lucide-react";
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
    <div className="container flex min-h-[calc(100vh-4rem)] items-center justify-center py-10">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card-glow">
        <h1 className="text-2xl font-bold">Create account</h1>
        <p className="mt-2 text-sm text-muted-foreground">Create a free Velora account, then add your own model key in settings when you want live providers.</p>
        <div className="mt-6 space-y-3">
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" required />
          <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" required />
          <Input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            type="password"
            required
          />
        </div>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <Button className="mt-5 w-full" type="submit">
          <UserPlus className="h-4 w-4" />
          Register
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-primary">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
