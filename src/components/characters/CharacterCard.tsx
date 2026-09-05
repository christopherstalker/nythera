"use client";

import Image from "next/image";
import Link from "next/link";
import { Bot, Heart, ShieldAlert, Star } from "lucide-react";
import { motion } from "motion/react";
import { RichMessageText } from "@/components/chat/rich-message-text";
import { cn } from "@/lib/utils";
import { displayTagLabel } from "@/lib/character-tags";
import { shouldBypassNextImageOptimization } from "@/lib/image-cache";
import { springSoft } from "@/lib/motion";
import { BRAND_ICON_LARGE } from "@/lib/brand";

export type CharacterSummary = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  description?: string | null;
  discoveryPlacement?: "STANDARD" | "FEATURED" | "WIDE";
  featuredScore?: number | null;
  tags?: string[];
  likes?: number;
  ratingAverage?: number;
  ratingCount?: number;
  isNSFW?: boolean;
  originType?: "ORIGINAL" | "PUBLIC_DOMAIN" | "LICENSED" | "FAN_INTERPRETATION" | "REAL_PERSON" | "HISTORICAL_FIGURE";
  isRealPerson?: boolean;
  aiDisclosure?: boolean;
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
  if (presentation === "discovery") {
    const rating = character.ratingAverage ?? 0;
    const avatarSrc = character.avatarUrl || BRAND_ICON_LARGE;

    return (
      <motion.div
        whileHover={{ y: -3 }}
        transition={springSoft}
        className={cn(
          "codex-character-plate group relative w-full overflow-hidden text-left",
          fill && "h-full",
          className
        )}
      >
        <Link
          href={`/character/${character.id}`}
          className="focus-ring absolute inset-0 z-20 no-underline"
          aria-label={`Open ${character.name}`}
        />
        <div className="codex-character-plate-image">
          <Image
            src={avatarSrc}
            alt={character.name}
            fill
            unoptimized={shouldBypassNextImageOptimization(avatarSrc)}
            sizes={featured ? "(min-width: 1280px) 50vw, 100vw" : "(min-width: 1280px) 25vw, 50vw"}
            className="h-full w-full object-cover"
            style={{ objectPosition: "center 20%" }}
          />
          <div className="codex-character-plate-veil" />
        </div>

        <div className="absolute left-3 right-3 top-3 z-10 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[11px] font-medium text-[var(--codex-ivory)]">
            <Star className="h-3.5 w-3.5 text-[oklch(var(--color-accent-secondary))]" />
            {character.ratingCount ? rating.toFixed(1) : "New"}
          </span>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-[var(--codex-ivory)] backdrop-blur-sm">
              <Bot className="h-3 w-3" /> AI
            </span>
            {featured ? (
              <span className="rounded-full bg-[var(--codex-mint)] px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-[var(--codex-paper)]">
                Featured
              </span>
            ) : null}
            {character.isNSFW ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-[var(--text-primary)]"
                style={{
                  background: "oklch(var(--color-danger) / .78)",
                  boxShadow: "var(--glass-highlight)"
                }}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                18+
              </span>
            ) : null}
          </div>
        </div>

        <div className="codex-character-plate-copy">
          <h3 className="font-editorial line-clamp-2 text-xl font-medium leading-tight text-[var(--codex-ivory)] sm:text-2xl">
            {character.name}
          </h3>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)] sm:text-sm">
            <RichMessageText text={character.description || "A story waiting to begin."} />
          </p>
          <div className="mt-2 hidden flex-wrap gap-x-3 gap-y-1 border-t border-[var(--codex-rule)] pt-2 sm:flex">
            {character.tags?.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="max-w-[9rem] truncate text-[9px] uppercase tracking-[.14em] text-[var(--text-muted)]"
              >
                {displayTagLabel(tag)}
              </span>
            ))}
          </div>
          <span className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Heart className="h-3.5 w-3.5" />
            {character.likes ?? 0}
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <Link
      href={`/character/${character.id}`}
      className={cn(
        "focus-ring flex w-full min-w-0 flex-col gap-3 border border-[var(--border-default)] bg-transparent p-4 text-left no-underline",
        fill && "h-full",
        className
      )}
      aria-label={`Open ${character.name}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-[var(--text-primary)]">{character.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">
            <RichMessageText text={character.description || "A story waiting to begin."} />
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-[var(--text-secondary)]">
          <Heart className="h-3.5 w-3.5" />
          {character.likes ?? 0}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1">
          <Star className="h-3.5 w-3.5" />
          {(character.ratingAverage ?? 0).toFixed(1)}
          {character.ratingCount ? <span>({character.ratingCount})</span> : null}
        </span>
        {character.isNSFW ? (
          <span className="inline-flex items-center gap-1">
            <ShieldAlert className="h-3.5 w-3.5" />
            18+
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <Bot className="h-3.5 w-3.5" />
          AI character
        </span>
        {character.tags?.length ? (
          <>
            {character.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="max-w-[9rem] truncate">
                {displayTagLabel(tag)}
              </span>
            ))}
          </>
        ) : null}
      </div>
    </Link>
  );
}
