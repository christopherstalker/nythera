"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Copy, KeyRound, Link2, Plus, ShieldCheck, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Connection = {
  id: string;
  name: string;
  scopes: string[];
  clientId: string | null;
  expiresAt: string;
  refreshExpiresAt: string | null;
};

const permissions = [
  { scope: "characters:read", label: "Read character cards", detail: "Your characters, their personalities and lore." },
  { scope: "characters:write", label: "Create and edit", detail: "New characters start private." },
  { scope: "characters:publish", label: "Publish and share", detail: "Allow changes to character visibility." }
];

export function IntegrationSettingsClient() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [endpoint, setEndpoint] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState(0);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState(["characters:read", "characters:write"]);
  const [busy, setBusy] = useState("");
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState("");
  const [showKeyForm, setShowKeyForm] = useState(false);

  async function loadConnections() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/integrations", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load your connections. Please try again.");
      const saved = await response.json();
      setConnections(saved.connections);
      setLoadedAt(Date.now());
      setEndpoint(saved.endpoint);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not load connections.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConnections();
  }, []);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setError("Clipboard access is unavailable. Select and copy the value manually.");
    }
  }

  async function createKey(event: FormEvent) {
    event.preventDefault();
    setBusy("create");
    setError("");
    setToken("");
    setCopied("");
    try {
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, scopes })
      });
      const issued = await response.json();
      if (!response.ok) throw new Error(issued.error ?? "Could not create this key.");
      setConnections((current) => [issued.connection, ...current]);
      setToken(issued.token);
      setName("");
      setShowKeyForm(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not create this key.");
    } finally {
      setBusy("");
    }
  }

  async function revoke(id: string) {
    setBusy(id);
    setError("");
    try {
      const response = await fetch("/api/integrations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (!response.ok) throw new Error("Could not disconnect this application. Please try again.");
      setConnections((current) => current.filter((connection) => connection.id !== id));
      setToken("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not disconnect this application.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5 sm:p-7">
        <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--accent-primary)]">
          <Link2 className="h-4 w-4" /> Your ideas, saved here
        </div>
        <h2 className="text-xl font-semibold">Create characters from your AI conversations</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
          Connect Nythera in ChatGPT or another compatible AI app. Describe a character, refine their story, and save
          the card straight to your library.
        </p>
        <ol className="my-6 grid gap-4 text-sm sm:grid-cols-3">
          {[
            "Add a custom MCP connection in your AI app.",
            "Paste this address and sign in to Nythera.",
            "Choose permissions, then start creating."
          ].map((step, index) => (
            <li key={step} className="flex gap-3 leading-6 text-[var(--text-secondary)]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] text-xs text-[var(--text-primary)]">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <label htmlFor="integration-endpoint" className="mb-2 block text-xs font-medium text-[var(--text-secondary)]">
          Connection address
        </label>
        <div className="flex min-w-0 gap-2">
          <Input
            id="integration-endpoint"
            readOnly
            value={endpoint}
            placeholder="Loading connection address…"
            className="min-w-0 font-mono text-xs"
          />
          <Button
            variant="secondary"
            disabled={!endpoint}
            onClick={() => void copy(endpoint, "address")}
            aria-label="Copy connection address"
          >
            {copied === "address" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
          Choose OAuth when asked how to sign in. Custom connections depend on your AI app and account.
        </p>
      </section>

      <div className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-primary)]" />
        <p className="leading-6">
          You control access to your characters. New cards start private. Your chats, model API keys and other users’
          private characters stay outside this connection.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 p-4 text-sm text-destructive"
        >
          {error}
          <Button variant="ghost" size="sm" onClick={() => void loadConnections()}>
            Reload connections
          </Button>
        </div>
      )}

      {token && (
        <section className="rounded-xl border border-[var(--accent-primary)] p-5" aria-label="New connection key">
          <h3 className="font-semibold">Your connection key</h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Copy it now. It is shown once and expires after 90 days. Store it in your AI app’s secret settings.
          </p>
          <div className="mt-4 flex min-w-0 gap-2">
            <Input aria-label="Connection key" value={token} readOnly type="password" className="min-w-0 font-mono" />
            <Button variant="secondary" onClick={() => void copy(token, "key")} aria-label="Copy connection key">
              {copied === "key" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => setToken("")}>
            Done, hide key
          </Button>
        </section>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Connected applications</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Disconnect an app to stop its access immediately.</p>
          </div>
          <Button
            variant="secondary"
            disabled={loading || !!busy}
            onClick={() => setShowKeyForm(!showKeyForm)}
            aria-expanded={showKeyForm}
          >
            <Plus className="h-4 w-4" /> Create a key
          </Button>
        </div>

        {showKeyForm && (
          <form onSubmit={createKey} className="mb-5 space-y-4 rounded-xl border border-[var(--border-default)] p-5">
            <div>
              <h3 className="font-medium">Connect with a key</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                For clients that support Bearer tokens. ChatGPT uses the sign-in flow above.
              </p>
            </div>
            <div>
              <label htmlFor="connection-name" className="mb-2 block text-sm">
                Application name
              </label>
              <Input
                id="connection-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                required
                placeholder="My writing assistant"
              />
            </div>
            <fieldset className="space-y-3">
              <legend className="mb-3 text-sm font-medium">Permissions</legend>
              {permissions.map(({ scope, label, detail }) => (
                <label key={scope} className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 accent-[var(--accent-primary)]"
                    checked={scopes.includes(scope)}
                    disabled={scope === "characters:read"}
                    onChange={(event) =>
                      setScopes((current) =>
                        event.target.checked ? [...current, scope] : current.filter((item) => item !== scope)
                      )
                    }
                  />
                  <span>
                    {label}
                    <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{detail}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="flex gap-2">
              <Button type="submit" disabled={!!busy || !name.trim()}>
                <KeyRound className="h-4 w-4" />
                {busy === "create" ? "Creating…" : "Create connection key"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowKeyForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <p role="status" className="py-8 text-sm text-[var(--text-muted)]">
            Loading connections…
          </p>
        ) : connections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-default)] px-5 py-8 text-center">
            <Link2 className="mx-auto mb-3 h-6 w-6 text-[var(--text-muted)]" />
            <p className="text-sm font-medium">Your next character starts with a connection</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Apps you authorize will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-default)] border-y border-[var(--border-default)]">
            {connections.map((connection) => {
              const expiry = new Date(connection.refreshExpiresAt ?? connection.expiresAt);
              const expired = expiry.getTime() <= loadedAt;
              return (
                <li key={connection.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 break-all text-sm font-medium">
                      {connection.clientId ? (
                        <ArrowUpRight className="h-4 w-4 shrink-0" />
                      ) : (
                        <KeyRound className="h-4 w-4 shrink-0" />
                      )}
                      {connection.name}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      {connection.scopes
                        .map((scope) => permissions.find((permission) => permission.scope === scope)?.label)
                        .join(" · ")}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {expired ? "Expired" : "Expires"} {expiry.toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!!busy}
                    onClick={() => void revoke(connection.id)}
                    aria-label={`Disconnect ${connection.name}`}
                  >
                    <Unplug className="h-4 w-4" />
                    {busy === connection.id ? "Disconnecting…" : "Disconnect"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <p className="sr-only" aria-live="polite">
        {copied ? `${copied === "key" ? "Connection key" : "Connection address"} copied.` : ""}
      </p>
    </div>
  );
}
