import { CharacterCard, type CharacterSummary } from "@/components/characters/CharacterCard";
import { SkeletonCard } from "@/components/ui/skeleton-card";

type CharacterGalleryProps = {
  characters: CharacterSummary[];
  loading?: boolean;
  title?: string;
};

const skeletonCount = 8;

export function CharacterGallery({ characters, loading = false, title }: CharacterGalleryProps) {
  const orderedCharacters = [...characters].sort((a, b) => {
    const placementDelta = placementWeight(b.discoveryPlacement) - placementWeight(a.discoveryPlacement);
    if (placementDelta !== 0) {
      return placementDelta;
    }
    return (b.featuredScore ?? 0) - (a.featuredScore ?? 0);
  });
  const count = loading ? skeletonCount : orderedCharacters.length;

  return (
    <section className="codex-catalog-section space-y-4">
      {title ? (
        <div className="flex items-end justify-between border-b border-[var(--codex-rule)] pb-3">
          <div>
            <p className="codex-kicker">Character index</p>
            <h2 className="font-editorial mt-1 text-3xl font-medium text-[var(--codex-ivory)]">{title}</h2>
          </div>
          <span className="text-[9px] uppercase tracking-[.18em] text-[var(--text-muted)]">{count} records</span>
        </div>
      ) : null}
      <ol className="codex-character-gallery">
        {loading
          ? Array.from({ length: skeletonCount }).map((_, index) => (
              <li key={index} className="codex-character-tile">
                <SkeletonCard className="h-full min-h-72 rounded-none" />
              </li>
            ))
          : orderedCharacters.map((character) => (
              <li key={character.id} className="codex-character-tile">
                <CharacterCard
                  character={character}
                  fill
                  featured={character.discoveryPlacement === "FEATURED"}
                  presentation="discovery"
                />
              </li>
            ))}
      </ol>
    </section>
  );
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
