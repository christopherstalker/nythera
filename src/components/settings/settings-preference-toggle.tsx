"use client";

import { useEffect, useState } from "react";
import { Brain, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

type Preference = "compactMode" | "memoryEnabled";

const preferenceCopy: Record<Preference, { label: string; description: string }> = {
  compactMode: {
    label: "Compact chat density",
    description: "Reduce the vertical spacing between chat messages and controls."
  },
  memoryEnabled: {
    label: "Use saved memories in character chats",
    description: "Allow characters to receive relevant memories from earlier conversations."
  }
};

export function SettingsPreferenceToggle({ preference }: { preference: Preference }) {
  const [enabled, setEnabled] = useState(preference === "memoryEnabled");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const copy = preferenceCopy[preference];
  const Icon = preference === "memoryEnabled" ? Brain : Eye;

  useEffect(() => {
    async function loadPreference() {
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        if (!response.ok) throw new Error();

        const body = await response.json();
        const profile = body?.profile;
        if (profile) {
          setEnabled(preference === "memoryEnabled" ? profile.memoryEnabled !== false : Boolean(profile.compactMode));
        }
      } catch {
        setStatus("Could not load this preference.");
      } finally {
        setLoading(false);
      }
    }

    void loadPreference();
  }, [preference]);

  async function toggle() {
    const previous = enabled;
    const next = !previous;
    setEnabled(next);
    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [preference]: next })
      });
      if (!response.ok) throw new Error();
      setStatus("Preference saved.");
    } catch {
      setEnabled(previous);
      setStatus("Could not save this preference.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-y border-[var(--border-default)] py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)]">{copy.label}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{copy.description}</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-label={copy.label}
          aria-checked={enabled}
          disabled={loading || saving}
          onClick={toggle}
          className={cn(
            "focus-ring relative h-7 w-12 shrink-0 rounded-[var(--radius-pill)] transition-colors duration-150 disabled:cursor-wait disabled:opacity-60",
            enabled
              ? "border border-[var(--codex-mint)]/55 bg-[color-mix(in_oklch,var(--codex-mint)_13%,transparent)]"
              : "border border-[var(--codex-rule)] bg-[var(--bg-elevated)]"
          )}
        >
          <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-[var(--codex-ivory)] transition-[left] duration-150", enabled ? "left-6" : "left-1")} />
        </button>
      </div>
      {status ? <p className="mt-3 text-xs text-[var(--text-secondary)]" role="status">{status}</p> : null}
    </div>
  );
}
