"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type MemoryRow = {
  id: string;
  content: string;
  category: string;
  importance: number;
  pinned: boolean;
  character?: { name: string } | null;
};

export function MemorySettingsClient() {
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const response = await fetch("/api/memories", { cache: "no-store" });
    if (!response.ok) {
      setStatus("Sign in to manage memories.");
      return;
    }
    const body = await response.json();
    setMemories(body.memories ?? []);
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) {
      return;
    }

    const response = await fetch("/api/memories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content,
        category: "FACT",
        importance: 1.5,
        pinned: true
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setStatus(body?.error ?? "Could not save memory.");
      return;
    }

    setContent("");
    setStatus("Memory saved.");
    await refresh();
  }

  async function togglePinned(memory: MemoryRow) {
    await fetch(`/api/memories?id=${encodeURIComponent(memory.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pinned: !memory.pinned })
    });
    await refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/memories?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setMemories((current) => current.filter((memory) => memory.id !== id));
  }

  return (
    <div className="grid gap-5">
      <form onSubmit={add} className="grid gap-3">
        <Textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Add a manual memory or recurring roleplay preference." />
        <Button type="submit" className="w-fit" disabled={!content.trim()}>
          <Plus className="h-4 w-4" />
          Add memory
        </Button>
      </form>

      <div className="grid gap-2">
        {memories.map((memory) => (
          <div key={memory.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-primary)]">{memory.content}</p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  {memory.category} · importance {memory.importance.toFixed(1)}
                  {memory.character?.name ? ` · ${memory.character.name}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant={memory.pinned ? "secondary" : "outline"} size="icon" aria-label="Toggle pinned" onClick={() => togglePinned(memory)}>
                  <Pin className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" aria-label="Delete memory" onClick={() => remove(memory.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {memories.length === 0 ? <p className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4 text-sm text-[var(--text-secondary)]">No memories saved yet.</p> : null}
      </div>

      {status ? <p className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-secondary)]">{status}</p> : null}
    </div>
  );
}
