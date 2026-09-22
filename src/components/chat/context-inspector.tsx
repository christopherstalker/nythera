"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Check, LoaderCircle, Minus, RefreshCw } from "lucide-react";
import type { ContextTrace } from "@/lib/context-trace";
import { Button } from "@/components/ui/button";

export function ContextInspector({ chatId, messageId }: { chatId: string; messageId?: string | null }) {
  const [trace, setTrace] = useState<ContextTrace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [showExcluded, setShowExcluded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setTrace(null);
    void fetch(`/api/chats/${chatId}/context${messageId ? `?messageId=${encodeURIComponent(messageId)}` : ""}`, {
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Could not load this reply’s context.");
        setTrace(body.trace);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setError(caught.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [chatId, messageId, attempt]);
  if (loading)
    return (
      <p role="status" className="flex items-center gap-2 py-8 text-sm text-[var(--text-muted)]">
        <LoaderCircle className="h-4 w-4 animate-spin" />
        Reading the saved context…
      </p>
    );
  if (error)
    return (
      <div role="alert">
        <p className="mb-3 text-sm text-rose-300">{error}</p>
        <Button variant="secondary" onClick={() => setAttempt((current) => current + 1)}>
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  if (!trace)
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-default)] p-7 text-center">
        <Brain className="mx-auto mb-3 h-6 w-6 text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-primary)]">No context snapshot for this reply</p>
        <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
          Snapshots are captured with new replies. Earlier messages and opening greetings do not have one.
        </p>
      </div>
    );
  const includedCount = trace.entries.filter((entry) => entry.included).length;
  const excludedCount = trace.entries.length - includedCount;
  return (
    <div className="grid gap-4">
      <p className="text-xs leading-5 text-[var(--text-secondary)]">
        Memory and lore prepared for the selected reply. Inclusion tells you what was sent, not whether the model used
        it correctly. This snapshot does not list every canon or persona rule.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--border-default)] p-3">
          <p className="text-xl font-semibold tabular-nums text-[var(--text-primary)]">{includedCount}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Memory & lore entries included</p>
        </div>
        <div className="rounded-xl border border-[var(--border-default)] p-3">
          <p className="text-xl font-semibold tabular-nums text-[var(--text-primary)]">
            {Math.round(trace.estimatedTokens).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Estimated prompt tokens</p>
        </div>
      </div>
      <p className="text-xs leading-5 text-[var(--text-muted)]">
        {trace.droppedMessages
          ? `${trace.droppedMessages} older messages removed to fit the context. `
          : "Recent messages fit the prepared context. "}
        {!trace.semanticEnabled ? "Semantic memory search was off; pinned facts can still apply. " : ""}Provider retries
        may shorten recent history further.
      </p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          Captured {new Date(trace.createdAt).toLocaleTimeString()}
        </span>
        {excludedCount ? (
          <button
            type="button"
            aria-pressed={showExcluded}
            onClick={() => setShowExcluded(!showExcluded)}
            className="focus-ring min-h-11 rounded-full border border-[var(--border-default)] px-3 text-xs text-[var(--text-muted)]"
          >
            {showExcluded ? "Hide" : "Show"} excluded · {excludedCount}
          </button>
        ) : null}
      </div>
      <div className="grid gap-2">
        {trace.entries
          .filter((entry) => entry.included || showExcluded)
          .map((entry, index) => (
            <article
              key={`${entry.kind}-${index}`}
              className={`rounded-xl border p-3 ${entry.included ? "border-[var(--border-default)] bg-[var(--bg-input)]" : "border-dashed border-[var(--border-default)]"}`}
            >
              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                {entry.included ? (
                  <Check className="h-3.5 w-3.5 text-[var(--accent-purple)]" />
                ) : (
                  <Minus className="h-3.5 w-3.5" />
                )}
                {entry.kind}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-secondary)]">
                {entry.text}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{entry.reason}</p>
            </article>
          ))}
      </div>
      {!includedCount ? (
        <p className="text-xs text-[var(--text-muted)]">
          No retrieved memory or lore entries were included in this snapshot.
        </p>
      ) : null}
      <Link
        href="/settings/memory"
        className="focus-ring text-xs text-[var(--accent-purple)] underline underline-offset-4"
      >
        Manage saved memories
      </Link>
    </div>
  );
}
