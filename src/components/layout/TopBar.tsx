"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Copy, Edit3, MoreVertical, PanelRightOpen, Share2, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

type TopBarProps = {
  chatId: string;
  characterId?: string | null;
  characterName: string;
  characterAvatarUrl?: string | null;
  onOpenQuickPanel?: () => void;
};

export function TopBar({ chatId, characterId, characterName, characterAvatarUrl, onOpenQuickPanel }: TopBarProps) {
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
    <header className="relative z-20 mx-auto flex h-[var(--touch-target)] max-w-[calc(100vw-1.5rem)] shrink-0 items-center gap-2 rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 shadow-[var(--shadow-soft)] backdrop-blur-2xl sm:mx-3 sm:h-16 sm:max-w-none sm:gap-3 sm:px-3 md:mx-4 md:px-4 lg:max-w-[calc(100%-0.5rem)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[rgb(var(--accent-rgb)_/_0.45)] to-transparent" />
      <button
        type="button"
        aria-label="Go back"
        onClick={() => router.back()}
        className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[var(--text-secondary)] transition-colors hover:bg-white/[0.055] hover:text-[var(--text-primary)] active:scale-95"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <Avatar name={characterName} src={characterAvatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold tracking-tight text-[var(--text-primary)]">{characterName}</h1>
      </div>
      <button
        type="button"
        aria-label="Open quick panel"
        onClick={onOpenQuickPanel}
        className="focus-ring grid h-10 w-10 place-items-center rounded-2xl text-[var(--text-secondary)] transition-colors hover:bg-white/[0.055] hover:text-[var(--text-primary)] active:scale-95"
      >
        <PanelRightOpen className="h-5 w-5" />
      </button>
      <div className="relative">
        <button
          type="button"
          aria-label="Open chat menu"
          onClick={() => setOpen((current) => !current)}
          className="focus-ring grid h-10 w-10 place-items-center rounded-2xl text-[var(--text-secondary)] transition-colors hover:bg-white/[0.055] hover:text-[var(--text-primary)] active:scale-95"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
        {open ? (
          <div className="absolute right-0 top-12 z-20 w-48 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1.5 shadow-[var(--shadow-card)] backdrop-blur-xl">
            <button type="button" onClick={shareChat} className="flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm text-[var(--text-secondary)] hover:bg-white/[0.055] hover:text-[var(--text-primary)]">
              <Share2 className="h-4 w-4" />
              Share
            </button>
            <button type="button" onClick={shareChat} className="flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm text-[var(--text-secondary)] hover:bg-white/[0.055] hover:text-[var(--text-primary)]">
              <Copy className="h-4 w-4" />
              Copy link
            </button>
            <Link
              href={characterId ? `/character/${characterId}` : "/explore"}
              className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm text-[var(--text-secondary)] no-underline hover:bg-white/[0.055] hover:text-[var(--text-primary)]"
              onClick={() => setOpen(false)}
            >
              <Edit3 className="h-4 w-4" />
              Character
            </Link>
            <button type="button" onClick={deleteChat} className="flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm text-red-300 hover:bg-red-500/10">
              <Trash2 className="h-4 w-4" />
              Delete chat
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
