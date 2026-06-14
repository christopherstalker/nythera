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
      <h2 className="px-1 text-xl font-semibold text-[var(--text-primary)]">{title}</h2>
      <div className="scrollbar-none mt-4 overflow-x-auto pb-2">
        <div className="flex w-max gap-4 px-1">
          {loading
            ? Array.from({ length: 8 }).map((_, index) => <SkeletonCard key={index} />)
            : characters.map((character) => <CharacterCard key={character.id} character={character} />)}
        </div>
      </div>
    </section>
  );
}
