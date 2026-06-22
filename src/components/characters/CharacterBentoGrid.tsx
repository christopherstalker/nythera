import { CharacterCard, type CharacterSummary } from "@/components/characters/CharacterCard";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { cn } from "@/lib/utils";

type CharacterBentoGridProps = {
  title: string;
  characters: CharacterSummary[];
  loading?: boolean;
};

const skeletonCount = 8;

export function CharacterBentoGrid({ title, characters, loading = false }: CharacterBentoGridProps) {
  const hasBentoDensity = loading || characters.length >= 4;

  return (
    <section className="space-y-3 sm:space-y-4">
      <h2 className="text-title px-1 font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
      <div className="nythera-bento-grid">
        {loading
          ? Array.from({ length: skeletonCount }).map((_, index) => (
              <SkeletonCard key={index} className={cn("nythera-bento-card !h-full min-h-[var(--card-height)]", bentoCellClass(index, true))} />
            ))
          : characters.map((character, index) => (
              <CharacterCard
                key={character.id}
                character={character}
                fill
                className={cn("nythera-bento-card", bentoCellClass(index, hasBentoDensity))}
              />
            ))}
      </div>
    </section>
  );
}

function bentoCellClass(index: number, enabled: boolean) {
  if (!enabled) {
    return undefined;
  }
  if (index === 0) {
    return "nythera-bento-featured";
  }
  if (index === 3) {
    return "nythera-bento-wide";
  }
  return undefined;
}
