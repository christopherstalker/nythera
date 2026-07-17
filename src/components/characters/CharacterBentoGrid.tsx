import { CharacterCard, type CharacterSummary } from "@/components/characters/CharacterCard";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { cn } from "@/lib/utils";

type CharacterBentoGridProps = {
  characters: CharacterSummary[];
  loading?: boolean;
  title?: string;
  layout?: "bento" | "shelf";
};

const skeletonCount = 8;

export function CharacterBentoGrid({ characters, loading = false, title, layout = "bento" }: CharacterBentoGridProps) {
  const orderedCharacters = [...characters].sort((a, b) => {
    const placementDelta = placementWeight(b.discoveryPlacement) - placementWeight(a.discoveryPlacement);
    if (placementDelta !== 0) {
      return placementDelta;
    }
    return (b.featuredScore ?? 0) - (a.featuredScore ?? 0);
  });
  const count = loading ? skeletonCount : orderedCharacters.length;

  return (
    <section className="codex-catalog-section space-y-5">
      {title ? <div className="flex items-end justify-between border-b border-[var(--codex-rule)] pb-3"><div><p className="codex-kicker">Selected folios</p><h2 className="font-editorial mt-1 text-3xl font-medium text-[var(--codex-ivory)]">{title}</h2></div><span className="text-[9px] uppercase tracking-[.18em] text-[var(--text-muted)]">{count} records</span></div> : null}
      <ol className={cn("codex-character-catalog nythera-bento-grid", layout === "shelf" && "is-shelf chat-scroll")}>
        {loading
          ? Array.from({ length: skeletonCount }).map((_, index) => {
              const placement = fallbackPlacement(index, count);
              return (
                <li key={index} className={cn("codex-character-record", bentoCellClass(placement))}><SkeletonCard className="h-full rounded-none" /></li>
              );
            })
          : orderedCharacters.map((character, index) => {
              const explicitCellClass = bentoCellClass(character.discoveryPlacement);
              const placement = resolvePlacement(character, index, count);

              return (
                <li
                  key={character.id}
                  className={cn(
                    "codex-character-record",
                    layout === "bento" && (explicitCellClass || bentoCellClass(placement))
                  )}
                >
                  <CharacterCard
                    character={character}
                    fill
                    featured={layout === "bento" && placement === "FEATURED"}
                    presentation="discovery"
                  />
                </li>
              );
            })}
      </ol>
    </section>
  );
}

function resolvePlacement(character: CharacterSummary, index: number, count: number): NonNullable<CharacterSummary["discoveryPlacement"]> {
  if (character.discoveryPlacement && character.discoveryPlacement !== "STANDARD") {
    return character.discoveryPlacement;
  }
  return fallbackPlacement(index, count);
}

function fallbackPlacement(index: number, count: number): NonNullable<CharacterSummary["discoveryPlacement"]> {
  if (count >= 3 && index === 0) {
    return "FEATURED";
  }
  if (count >= 4 && index === 3) {
    return "WIDE";
  }
  return "STANDARD";
}

function bentoCellClass(placement?: CharacterSummary["discoveryPlacement"]) {
  if (placement === "FEATURED") {
    return "nythera-bento-featured";
  }
  if (placement === "WIDE") {
    return "nythera-bento-wide";
  }
  return "";
}

function placementWeight(placement?: CharacterSummary["discoveryPlacement"]) {
  if (placement === "FEATURED") {
    return 2;
  }
  if (placement === "WIDE") {
    return 1;
  }
  return 0;
}
