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
    <section className="space-y-4">
      {title ? <h2 className="text-2xl font-semibold text-content-primary">{title}</h2> : null}
      <div className={cn(layout === "shelf" ? "orbital-character-shelf chat-scroll" : "nythera-bento-grid")}>
        {loading
          ? Array.from({ length: skeletonCount }).map((_, index) => {
              const placement = fallbackPlacement(index, count);
              return (
                <SkeletonCard
                  key={index}
                  className={cn(layout === "bento" && "nythera-bento-card", layout === "bento" && bentoCellClass(placement))}
                />
              );
            })
          : orderedCharacters.map((character, index) => {
              const explicitCellClass = bentoCellClass(character.discoveryPlacement);
              const placement = resolvePlacement(character, index, count);

              return (
                <div
                  key={character.id}
                  className={cn(
                    layout === "bento" && "nythera-bento-card",
                    layout === "bento" && (explicitCellClass || bentoCellClass(placement))
                  )}
                >
                  <CharacterCard
                    character={character}
                    fill
                    featured={layout === "bento" && placement === "FEATURED"}
                    presentation="discovery"
                  />
                </div>
              );
            })}
      </div>
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
