"use client";

import { useRouter } from "next/navigation";
import { Heart, ShieldAlert, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { displayTagLabel } from "@/lib/character-tags";

export type CharacterSummary = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  description?: string | null;
  tags?: string[];
  likes?: number;
  ratingAverage?: number;
  ratingCount?: number;
  isNSFW?: boolean;
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

  function openProfile() {
    router.push(`/character/${character.id}`);
  }

  return (
    <button
      type="button"
      onClick={openProfile}
      className={cn(
        "group glass-card glass-card-hover relative flex h-[var(--card-height)] w-full min-w-0 shrink-0 overflow-hidden text-left active:scale-[0.98]",
        className
      )}
      aria-label={`Open ${character.name}`}
    >
      <div className="absolute inset-x-0 top-0 h-[72%] overflow-hidden">
        {character.avatarUrl ? (
          <img
            src={character.avatarUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[linear-gradient(145deg,rgb(var(--accent-rgb)_/_0.18),rgb(11_11_18))] text-5xl font-semibold text-[var(--accent-purple)]">
            {character.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-[#0b0b12]/88" />
        <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
          <span className="inline-flex h-8 items-center gap-1 rounded-full border border-white/10 bg-black/34 px-2.5 text-[11px] font-semibold text-white shadow-[var(--glass-highlight)] backdrop-blur-md">
            <Star className="h-3.5 w-3.5 fill-[var(--accent-purple)] text-[var(--accent-purple)]" />
            {(character.ratingAverage ?? 0).toFixed(1)}
            {character.ratingCount ? <span className="text-white/58">({character.ratingCount})</span> : null}
          </span>
          {character.isNSFW ? (
            <span className="inline-flex h-8 items-center gap-1 rounded-full border border-red-300/20 bg-red-500/20 px-2.5 text-[11px] font-semibold text-red-100 backdrop-blur-md">
              <ShieldAlert className="h-3.5 w-3.5" />
              18+
            </span>
          ) : null}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-9">
        <div className="flex items-center justify-between gap-2">
          <h3 className="min-w-0 truncate text-base font-semibold tracking-tight text-white">{character.name}</h3>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)]">
            <Heart className="h-3.5 w-3.5 fill-[var(--accent-secondary)] text-[var(--accent-secondary)]" />
            {character.likes ?? 0}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">
          {character.description || "A story waiting to begin."}
        </p>
        {character.tags?.length ? (
          <div className="mt-2 flex min-h-6 gap-1.5 overflow-hidden">
            {character.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="max-w-[7.5rem] truncate rounded-full border border-white/10 bg-white/[0.055] px-2 py-0.5 text-[10px] font-medium text-white/76">
                {displayTagLabel(tag)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}
