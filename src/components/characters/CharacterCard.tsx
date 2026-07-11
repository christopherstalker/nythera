"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Heart, ShieldAlert, Star } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { displayTagLabel } from "@/lib/character-tags";
import { shouldBypassNextImageOptimization } from "@/lib/image-cache";
import { springSoft } from "@/lib/motion";

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
    const rating = character.ratingAverage ?? 0;
    const avatarSrc = character.avatarUrl || "/icons/velora-aurora-v4-512.png";

    return (
      <motion.button
        type="button"
        onClick={openProfile}
        whileHover={{ y: -6, scale: 1.015 }}
        transition={springSoft}
        className={cn(
          "focus-ring orbital-glass group relative w-full overflow-hidden rounded-[20px] text-left",
          fill && "h-full",
          className
        )}
        aria-label={`Open ${character.name}`}
      >
        <Image
          src={avatarSrc}
          alt={character.name}
          fill
          unoptimized={shouldBypassNextImageOptimization(avatarSrc)}
          sizes={featured ? "(min-width: 1280px) 50vw, 100vw" : "(min-width: 1280px) 25vw, 50vw"}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center 20%" }}
        />

        <div className="absolute left-3 right-3 top-3 z-10 flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-[var(--text-primary)]"
            style={{
              background: "color-mix(in oklch, var(--color-surface) 48%, transparent)",
              backdropFilter: "blur(var(--glass-blur-sm)) saturate(var(--glass-saturation))",
              WebkitBackdropFilter: "blur(var(--glass-blur-sm)) saturate(var(--glass-saturation))",
              boxShadow: "var(--glass-highlight)"
            }}
          >
            <Star className="h-3.5 w-3.5 text-[oklch(var(--color-accent-secondary))]" />
            {rating.toFixed(1)}
          </span>
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

        <div
          className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end p-4"
          style={{
            minHeight: featured ? "68%" : "60%",
            background:
              "linear-gradient(to top, oklch(var(--color-canvas) / .94) 0%, oklch(var(--color-canvas) / .64) 58%, transparent 100%)"
          }}
        >
          <h3 className={cn("font-semibold leading-tight text-[var(--text-primary)]", featured ? "line-clamp-2 text-2xl" : "line-clamp-1 text-lg")}>
            {character.name}
          </h3>
          <p className={cn("mt-1 text-sm leading-6 text-[var(--text-secondary)]", featured ? "line-clamp-3" : "line-clamp-2")}>
            {character.description || "A story waiting to begin."}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {character.tags?.slice(0, featured ? 3 : 2).map((tag) => (
              <span
                key={tag}
                className="max-w-[9rem] truncate rounded-full px-2 py-1 text-xs font-medium text-[var(--text-primary)]"
                style={{
                  background: "color-mix(in oklch, var(--color-surface) 42%, transparent)",
                  backdropFilter: "blur(var(--glass-blur-sm)) saturate(var(--glass-saturation))",
                  WebkitBackdropFilter: "blur(var(--glass-blur-sm)) saturate(var(--glass-saturation))",
                  boxShadow: "var(--glass-highlight)"
                }}
              >
                {displayTagLabel(tag)}
              </span>
            ))}
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Heart className="h-3.5 w-3.5" />
            {character.likes ?? 0}
          </span>
        </div>
      </motion.button>
    );
  }

  return (
    <button
      type="button"
      onClick={openProfile}
      className={cn(
        "focus-ring flex w-full min-w-0 flex-col gap-3 border border-[var(--border-default)] bg-transparent p-4 text-left",
        fill && "h-full",
        className
      )}
      aria-label={`Open ${character.name}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-[var(--text-primary)]">{character.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">
            {character.description || "A story waiting to begin."}
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
    </button>
  );
}
