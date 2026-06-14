"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Copy, Edit3, MoreVertical, Share2, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

type TopBarProps = {
  chatId: string;
  characterId?: string | null;
  characterName: string;
  characterAvatarUrl?: string | null;
};

export function TopBar({ chatId, characterId, characterName, characterAvatarUrl }: TopBarProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function shareChat() {
    const response = await fetch(`/api/chats/${chatId}/share`, { method: "POST" });
    if (!response.ok) {
      return;
    }
    const body = await response.json();
    const url = `${window.location.origin}${body.url}`;
    await navigator.clipboard?.writeText(url);
    setOpen(false);
  }

  async function deleteChat() {
    await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
    setOpen(false);
    router.push("/chats");
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border-default)] bg-[var(--bg-base)] px-4">
      <button
        type="button"
        aria-label="Go back"
        onClick={() => router.back()}
        className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] active:scale-95"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <Avatar name={characterName} src={characterAvatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-[var(--text-primary)]">{characterName}</h1>
      </div>
      <div className="relative">
        <button
          type="button"
          aria-label="Open chat menu"
          onClick={() => setOpen((current) => !current)}
          className="focus-ring grid h-9 w-9 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] active:scale-95"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
        {open ? (
          <div className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1 shadow-[var(--shadow-card)]">
            <button type="button" onClick={shareChat} className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]">
              <Share2 className="h-4 w-4" />
              Share
            </button>
            <button type="button" onClick={shareChat} className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]">
              <Copy className="h-4 w-4" />
              Copy link
            </button>
            <Link
              href={characterId ? `/character/${characterId}` : "/explore"}
              className="flex h-9 items-center gap-2 rounded-md px-3 text-sm text-[var(--text-secondary)] no-underline hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
              onClick={() => setOpen(false)}
            >
              <Edit3 className="h-4 w-4" />
              Character
            </Link>
            <button type="button" onClick={deleteChat} className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-sm text-red-300 hover:bg-red-500/10">
              <Trash2 className="h-4 w-4" />
              Delete chat
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
