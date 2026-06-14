"use client";

import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
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
  const creator = character.creator?.username ?? "velora";

  function openProfile() {
    if (character.id.startsWith("sample-")) {
      router.push("/create-character");
      return;
    }

    router.push(`/character/${character.id}`);
  }

  return (
    <button
      type="button"
      onClick={openProfile}
      className={cn(
        "group relative flex h-[220px] w-[160px] shrink-0 overflow-hidden rounded-xl border border-transparent bg-[var(--bg-elevated)] text-left shadow-[var(--shadow-card)] transition-all duration-200 hover:scale-[1.02] hover:border-[var(--accent-purple)] hover:shadow-lg active:scale-95",
        className
      )}
      aria-label={`Open ${character.name}`}
    >
      <div className="absolute inset-x-0 top-0 h-[75%] overflow-hidden">
        {character.avatarUrl ? (
          <img
            src={character.avatarUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,#342044,#1f1f1f)] text-5xl font-semibold text-[var(--accent-purple)]">
            {character.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/5 to-black/65" />
      </div>
      <div className="absolute inset-x-0 bottom-0 min-h-[55px] bg-[linear-gradient(180deg,rgba(13,13,13,0.42),rgba(13,13,13,0.98))] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <h3 className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-white">{character.name}</h3>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--accent-purple)] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        </div>
        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">@{creator}</p>
      </div>
    </button>
  );
}
