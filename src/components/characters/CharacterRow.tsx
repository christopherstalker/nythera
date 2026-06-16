import { CharacterCard, type CharacterSummary } from "@/components/characters/CharacterCard";
import { SkeletonCard } from "@/components/ui/skeleton-card";

type CharacterRowProps = {
  title: string;
  characters: CharacterSummary[];
  loading?: boolean;
};

export function CharacterRow({ title, characters, loading = false }: CharacterRowProps) {
  return (
    <section>
      <h2 className="text-title px-1 font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
      <div className="scrollbar-none mt-3 overflow-x-auto pb-2 sm:mt-4">
        <div className="flex w-max gap-[var(--grid-gap)] px-1">
          {loading
            ? Array.from({ length: 8 }).map((_, index) => <SkeletonCard key={index} className="nythera-row-card" />)
            : characters.map((character) => (
                <CharacterCard key={character.id} character={character} className="nythera-row-card" />
              ))}
        </div>
      </div>
    </section>
  );
}
