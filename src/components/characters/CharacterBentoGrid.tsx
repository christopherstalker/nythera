import { CharacterCard, type CharacterSummary } from "@/components/characters/CharacterCard";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { cn } from "@/lib/utils";

type CharacterBentoGridProps = {
  characters: CharacterSummary[];
  loading?: boolean;
  title?: string;
};

const skeletonCount = 8;

export function CharacterBentoGrid({ characters, loading = false, title }: CharacterBentoGridProps) {
  return (
    <section className="space-y-3 sm:space-y-4">
      {title ? <h2 className="text-title px-1 font-semibold tracking-tight text-content-primary">{title}</h2> : null}
      <div className="nythera-bento-grid grid auto-rows-[var(--card-height)] grid-cols-1 gap-[var(--grid-gap)] sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: skeletonCount }).map((_, index) => (
              <SkeletonCard
                key={index}
                className={cn("nythera-bento-card !h-full min-h-[var(--card-height)]", skeletonBentoCellClass(index))}
              />
            ))
          : characters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                fill
                presentation="discovery"
                featured={character.discoveryPlacement === "FEATURED"}
                className={cn("nythera-bento-card", bentoCellClass(character.discoveryPlacement))}
              />
            ))}
      </div>
    </section>
  );
}

export function bentoCellClass(placement?: CharacterSummary["discoveryPlacement"]) {
  if (placement === "FEATURED") {
    return "nythera-bento-featured xl:col-span-2 xl:row-span-2";
  }
  if (placement === "WIDE") {
    return "nythera-bento-wide xl:col-span-2";
  }
  return undefined;
}

function skeletonBentoCellClass(index: number) {
  if (index === 0) {
    return bentoCellClass("FEATURED");
  }
  if (index === 1) {
    return bentoCellClass("WIDE");
  }
  return undefined;
}
