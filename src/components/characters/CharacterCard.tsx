"use client";

import { useRouter } from "next/navigation";
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

  function openProfile() {
    router.push(`/character/${character.id}`);
  }

  return (
    <button
      type="button"
      onClick={openProfile}
      className={cn(
        "group glass-card glass-card-hover relative flex h-[280px] w-full min-w-[176px] shrink-0 overflow-hidden text-left active:scale-[0.98] sm:h-[300px]",
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
      </div>
      <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-10">
        <h3 className="truncate text-base font-semibold tracking-tight text-white">{character.name}</h3>
        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">
          {character.description || "A story waiting to begin."}
        </p>
      </div>
    </button>
  );
}
