"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Ellipsis, Gem, PanelRightOpen, Share2, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

type TopBarProps = {
  chatId: string;
  characterId?: string | null;
  characterName: string;
  characterAvatarUrl?: string | null;
  onOpenQuickPanel?: () => void;
  showQuickPanelButton?: boolean;
};

export function TopBar({ chatId, characterId, characterName, characterAvatarUrl, onOpenQuickPanel, showQuickPanelButton = true }: TopBarProps) {
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
    <header className="relative z-20 mx-auto flex h-12 max-w-[calc(100vw-0.75rem)] shrink-0 items-center gap-1.5 rounded-[18px] border border-white/[0.08] bg-[color:oklch(var(--color-canvas)/.52)] px-1.5 shadow-[0_14px_42px_oklch(0_0_0/.20),var(--glass-highlight)] backdrop-blur-2xl sm:mx-3 sm:h-14 sm:max-w-none sm:gap-2 sm:px-2 md:mx-4 md:px-3 lg:max-w-[calc(100%-0.5rem)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[color:oklch(var(--color-accent-secondary)/.52)] to-transparent" />
      <button
        type="button"
        aria-label="Go back"
        onClick={() => router.back()}
        className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-[14px] text-[var(--text-secondary)] transition-colors hover:bg-white/[0.055] hover:text-[var(--text-primary)] active:scale-95 sm:h-10 sm:w-10"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <Avatar name={characterName} src={characterAvatarUrl} size="sm" className="h-9 w-9 border-0 shadow-[0_0_32px_oklch(var(--color-accent-primary)/.18)] sm:h-10 sm:w-10" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)] sm:text-base">{characterName}</h1>
      </div>
      {showQuickPanelButton ? (
        <button
          type="button"
          aria-label="Open quick panel"
          onClick={onOpenQuickPanel}
          className="focus-ring hidden h-9 w-9 place-items-center rounded-[14px] text-[var(--text-secondary)] transition-colors hover:bg-white/[0.055] hover:text-[var(--text-primary)] active:scale-95 md:grid"
        >
          <PanelRightOpen className="h-[18px] w-[18px]" />
        </button>
      ) : null}
      <div className="relative">
        <button
          type="button"
          aria-label="Open chat menu"
          onClick={() => setOpen((current) => !current)}
          className="focus-ring grid h-9 w-9 place-items-center rounded-[14px] text-[var(--text-secondary)] transition-colors hover:bg-white/[0.055] hover:text-[var(--text-primary)] active:scale-95 sm:h-10 sm:w-10"
        >
          <Ellipsis className="h-5 w-5" />
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
              <Gem className="h-4 w-4" />
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
