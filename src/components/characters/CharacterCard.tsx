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
  featured?: boolean;
  fill?: boolean;
  presentation?: "default" | "discovery";
};

export function CharacterCard({
  character,
  className,
  featured = false,
  fill = false,
  presentation = "default"
}: CharacterCardProps) {
  const router = useRouter();

  function openProfile() {
    router.push(`/character/${character.id}`);
  }

  if (presentation === "discovery") {
    return (
      <button
        type="button"
        onClick={openProfile}
        className={cn(
          "focus-ring group relative flex w-full min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-outline-subtle bg-canvas text-left shadow-raised transition duration-200 hover:-translate-y-1 hover:border-outline-strong hover:shadow-floating active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none",
          fill ? "h-full min-h-[var(--card-height)]" : "h-[var(--card-height)]",
          className
        )}
        aria-label={`Open ${character.name}`}
      >
        {character.avatarUrl ? (
          <img
            src={character.avatarUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035] motion-reduce:transform-none motion-reduce:transition-none"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-aurora-ambient text-5xl font-semibold text-content-primary">
            {character.name.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,transparent_18%,oklch(var(--color-canvas)/0.12)_42%,oklch(var(--color-canvas)/0.96)_100%)]"
        />

        <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2 sm:inset-x-4 sm:top-4">
          <span className="inline-flex h-8 items-center gap-1 rounded-full border border-outline-subtle bg-canvas/80 px-2.5 text-[11px] font-semibold text-content-primary shadow-raised">
            <Star className="h-3.5 w-3.5 fill-primary text-primary" />
            {(character.ratingAverage ?? 0).toFixed(1)}
            {character.ratingCount ? <span className="text-content-muted">({character.ratingCount})</span> : null}
          </span>
          {character.isNSFW ? (
            <span className="inline-flex h-8 items-center gap-1 rounded-full border border-danger/30 bg-danger/20 px-2.5 text-[11px] font-semibold text-content-primary">
              <ShieldAlert className="h-3.5 w-3.5" />
              18+
            </span>
          ) : null}
        </div>

        <div className={cn("absolute inset-x-0 bottom-0 p-4 sm:p-5", featured && "sm:p-7")}>
          <div className="flex items-end justify-between gap-3">
            <h3
              className={cn(
                "min-w-0 truncate font-semibold tracking-tight text-content-primary",
                featured ? "text-2xl sm:text-3xl" : "text-lg"
              )}
            >
              {character.name}
            </h3>
            <span className="inline-flex shrink-0 items-center gap-1 pb-0.5 text-xs font-semibold text-content-secondary">
              <Heart className="h-4 w-4 fill-brand-secondary text-brand-secondary" />
              {character.likes ?? 0}
            </span>
          </div>
          <p
            className={cn(
              "mt-2 text-sm leading-6 text-content-secondary",
              featured ? "line-clamp-3 max-w-xl sm:text-base sm:leading-7" : "line-clamp-2"
            )}
          >
            {character.description || "A story waiting to begin."}
          </p>
          {character.tags?.length ? (
            <div className="mt-3 flex min-h-6 flex-wrap gap-1.5 overflow-hidden">
              {character.tags.slice(0, featured ? 3 : 2).map((tag) => (
                <span
                  key={tag}
                  className="max-w-[9rem] truncate rounded-full border border-outline-subtle bg-canvas/72 px-2.5 py-1 text-[10px] font-semibold text-content-primary"
                >
                  {displayTagLabel(tag)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openProfile}
      className={cn(
        "group glass-card glass-card-hover glass-depth-card relative flex w-full min-w-0 shrink-0 text-left active:scale-[0.98]",
        fill ? "h-full min-h-[var(--card-height)]" : "h-[var(--card-height)]",
        className
      )}
      aria-label={`Open ${character.name}`}
    >
      <div className="absolute inset-x-0 top-0 h-[72%] overflow-hidden rounded-t-[var(--radius-lg)]">
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
