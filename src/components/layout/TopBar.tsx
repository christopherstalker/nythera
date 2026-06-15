"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Copy, Edit3, Menu, Plus, Share2, Trash2, UserRound, VolumeX } from "lucide-react";
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
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40 px-4 pt-4 md:px-6 md:pt-5">
      <div className="mx-auto flex max-w-[1120px] items-center gap-2">
        <button
          type="button"
          aria-label="Go back"
          onClick={() => router.back()}
          className="focus-ring pointer-events-auto grid h-12 w-10 shrink-0 place-items-center rounded-full text-white drop-shadow transition hover:bg-white/10 active:scale-95 md:h-14 md:w-12"
        >
          <ChevronLeft className="h-8 w-8 stroke-[3]" />
        </button>

        <Link
          href={characterId ? `/character/${characterId}` : "/explore"}
          className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-full bg-black/28 py-1.5 pl-1.5 pr-4 text-white no-underline shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_28px_rgba(0,0,0,0.25)] backdrop-blur-2xl"
        >
          <Avatar name={characterName} src={characterAvatarUrl} size="sm" className="h-12 w-12 border border-white/20 md:h-14 md:w-14" />
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[18px] font-black leading-none md:text-[20px]">{characterName}</span>
              <span className="grid h-7 w-8 shrink-0 place-items-center rounded-full bg-white text-black">
                <Plus className="h-5 w-5 stroke-[3]" />
              </span>
            </span>
            <span className="mt-1 flex items-center gap-1 text-[13px] font-bold leading-none text-white/52">
              <UserRound className="h-3.5 w-3.5 fill-white/50" />
              Velora
            </span>
          </span>
        </Link>

        <div className="pointer-events-auto relative ml-auto flex h-14 items-center rounded-full bg-black/30 px-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_28px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
          <button type="button" aria-label="Mute voice" className="focus-ring grid h-10 w-10 place-items-center rounded-full transition hover:bg-white/10">
            <VolumeX className="h-7 w-7 stroke-[2.8]" />
          </button>
          <span className="mx-2 h-7 w-px bg-white/22" aria-hidden="true" />
          <button
            type="button"
            aria-label="Open chat menu"
            onClick={() => setOpen((current) => !current)}
            className="focus-ring grid h-10 w-10 place-items-center rounded-full transition hover:bg-white/10"
          >
            <Menu className="h-7 w-7 stroke-[2.8]" />
          </button>
          {open ? (
            <div className="absolute right-0 top-16 z-20 w-48 overflow-hidden rounded-[18px] border border-white/10 bg-[#111]/95 p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <button type="button" onClick={shareChat} className="flex h-10 w-full items-center gap-2 rounded-[14px] px-3 text-sm font-bold text-white/74 hover:bg-white/10 hover:text-white">
                <Share2 className="h-4 w-4" />
                Share
              </button>
              <button type="button" onClick={shareChat} className="flex h-10 w-full items-center gap-2 rounded-[14px] px-3 text-sm font-bold text-white/74 hover:bg-white/10 hover:text-white">
                <Copy className="h-4 w-4" />
                Copy link
              </button>
              <Link
                href={characterId ? `/character/${characterId}` : "/explore"}
                className="flex h-10 items-center gap-2 rounded-[14px] px-3 text-sm font-bold text-white/74 no-underline hover:bg-white/10 hover:text-white"
                onClick={() => setOpen(false)}
              >
                <Edit3 className="h-4 w-4" />
                Character
              </Link>
              <button type="button" onClick={deleteChat} className="flex h-10 w-full items-center gap-2 rounded-[14px] px-3 text-sm font-bold text-red-300 hover:bg-red-500/10">
                <Trash2 className="h-4 w-4" />
                Delete chat
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
