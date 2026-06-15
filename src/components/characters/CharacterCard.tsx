"use client";

import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
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
  const likes = compactCount(character.likes ?? 0);
  const tags = character.tags?.slice(0, 2) ?? [];

  function openProfile() {
    router.push(`/character/${character.id}`);
  }

  return (
    <button
      type="button"
      onClick={openProfile}
      className={cn(
        "group relative inline-block h-[340px] w-[172px] shrink-0 overflow-hidden rounded-[8px] bg-[#111] text-left shadow-[0_16px_38px_rgba(0,0,0,0.42)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_54px_rgba(0,0,0,0.52)] active:scale-[0.985]",
        className
      )}
      aria-label={`Open ${character.name}`}
    >
      <div className="absolute inset-x-0 top-0 h-[58%] overflow-hidden bg-[#151515]">
        {character.avatarUrl ? (
          <img
            src={character.avatarUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[#151515]">
            <img src="/icon.svg" alt="" className="h-20 w-20 rounded-[28px] opacity-90" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/5 to-black/72" />
        <span className="absolute bottom-4 left-3 inline-flex items-center gap-1 text-[15px] font-extrabold leading-none text-white drop-shadow">
          <MessageCircle className="h-4 w-4 fill-white text-white" />
          {likes}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 min-h-[42%] bg-[#101010] px-3.5 py-3">
        <h3 className="line-clamp-2 text-[22px] font-black leading-[1.04] text-white md:text-[24px]">{character.name}</h3>
        <p className="mt-3 line-clamp-3 text-[17px] font-bold leading-[1.25] text-[#9d9d9d]">
          {character.description || `@${creator}`}
        </p>
        {tags.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-white/[0.09] px-3 py-1.5 text-xs font-extrabold text-[#bdbdbd]">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}

function compactCount(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  }

  return String(value);
}
