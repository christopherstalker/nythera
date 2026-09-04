"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeLocalRedirect } from "@/lib/safe-local-redirect";

export function AccountPasswordClient({
  setup = false,
  callbackUrl = "/explore",
}: {
  setup?: boolean;
  callbackUrl?: string;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    void fetch("/api/account/password", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body) => setHasPassword(Boolean(body.hasPassword)))
      .catch(() => setMessage("Could not load password settings."));
  }, [sessionStatus]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (newPassword !== confirmation) {
      setMessage("Passwords do not match.");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/account/password", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: currentPassword || undefined,
        newPassword,
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setSaving(false);
      setMessage(body?.error ?? "Could not update the password.");
      return;
    }

    const email = session?.user?.email;
    if (email) {
      await signIn("credentials", {
        email,
        password: newPassword,
        redirect: false,
      });
    }
    window.location.href = safeLocalRedirect(callbackUrl);
  }

  if (sessionStatus === "unauthenticated") {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        Sign in to manage your password.
      </p>
    );
  }

  return (
    <form
      onSubmit={save}
      className="grid gap-4 border-y border-[var(--border-default)] py-5"
    >
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {hasPassword ? "Change password" : "Set an account password"}
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
          {setup
            ? "Add email-and-password access to the account you just created."
            : "A password lets you sign in even when an external provider is unavailable."}
        </p>
      </div>
      {hasPassword ? (
        <Input
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          required
        />
      ) : null}
      <Input
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        type="password"
        autoComplete="new-password"
        placeholder="New password (8+ characters)"
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
      <Button type="submit" disabled={saving || hasPassword === null}>
        <KeyRound className="h-4 w-4" />
        {saving
          ? "Saving..."
          : hasPassword
            ? "Change password"
            : "Set password"}
      </Button>
    </form>
  );
}
