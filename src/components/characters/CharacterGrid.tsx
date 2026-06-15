import { CharacterCard, type CharacterSummary } from "@/components/characters/CharacterCard";
import { SkeletonCard } from "@/components/ui/skeleton-card";

type CharacterGridProps = {
  characters: CharacterSummary[];
  loading?: boolean;
};

export function CharacterGrid({ characters, loading = false }: CharacterGridProps) {
  if (loading) {
    return (
      <div className="columns-2 gap-2 sm:columns-3 lg:columns-4 2xl:columns-5">
        {Array.from({ length: 15 }).map((_, index) => <SkeletonCard key={index} className={getCardHeight(index)} />)}
      </div>
    );
  }

  return (
    <div className="columns-2 gap-2 sm:columns-3 lg:columns-4 2xl:columns-5">
      {characters.map((character, index) => (
        <CharacterCard key={character.id} character={character} className={getCardHeight(index)} />
      ))}
    </div>
  );
}

function getCardHeight(index: number) {
  const heights = ["mb-2 h-[344px] w-full", "mb-2 h-[416px] w-full", "mb-2 h-[286px] w-full", "mb-2 h-[372px] w-full"];
  return heights[index % heights.length];
}
