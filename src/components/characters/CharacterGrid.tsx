import { CharacterCard, type CharacterSummary } from "@/components/characters/CharacterCard";
import { SkeletonCard } from "@/components/ui/skeleton-card";

type CharacterGridProps = {
  characters: CharacterSummary[];
  loading?: boolean;
};

export function CharacterGrid({ characters, loading = false }: CharacterGridProps) {
  if (loading) {
    return (
      <div className="nythera-character-grid">
        {Array.from({ length: 15 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className="nythera-character-grid">
      {characters.map((character) => (
        <CharacterCard key={character.id} character={character} />
      ))}
    </div>
  );
}
