"use client";

import { useRouter } from "next/navigation";
import { ExternalLink, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export type CharacterSummary = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  description?: string | null;
  tags?: string[];
  likes?: number;
  ratingAverage?: number;
  creator?: {
    username?: string | null;
  } | null;
};

type CharacterCardProps = {
  character: CharacterSummary;
  className?: string;
};

export function CharacterCard({ character, className }: CharacterCardProps) {
  const router = useRouter();
  const creator = character.creator?.username ?? "user";

  function openProfile() {
    router.push(`/character/${character.id}`);
  }

  return (
    <button
      type="button"
      onClick={openProfile}
      className={cn(
        "group glass-card glass-card-hover relative flex h-[282px] w-full min-w-[176px] shrink-0 overflow-hidden text-left active:scale-[0.98]",
        className
      )}
      aria-label={`Open ${character.name}`}
    >
      <div className="absolute inset-x-0 top-0 h-[64%] overflow-hidden">
        {character.avatarUrl ? (
          <img
            src={character.avatarUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[linear-gradient(145deg,rgb(var(--accent-rgb)_/_0.24),rgb(20_20_35))] text-6xl font-semibold text-[var(--accent-purple)]">
            {character.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/8 to-[#0b0b12]/80" />
      </div>
      <div className="absolute inset-x-0 bottom-0 min-h-[112px] bg-[linear-gradient(180deg,rgb(11_11_18_/_0.22),rgb(11_11_18_/_0.94)_34%,rgb(11_11_18_/_0.98))] px-4 pb-4 pt-5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold leading-6 tracking-tight text-white">{character.name}</h3>
            <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">@{creator}</p>
          </div>
          <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-[var(--accent-purple)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        </div>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">
          {character.description || "A new persona waiting for the first scene."}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
          <span className="truncate">{character.tags?.slice(0, 2).join(" / ") || "roleplay"}</span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[var(--text-secondary)]">
            <Heart className="h-3.5 w-3.5 text-[#f0a8c8]" />
            {character.likes ?? 0}
          </span>
        </div>
      </div>
    </button>
  );
}
