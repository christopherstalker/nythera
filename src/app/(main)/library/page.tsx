"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookMarked, Compass, Plus, Search } from "lucide-react";
import { motion } from "motion/react";
import { CharacterRosterCard } from "@/components/library/character-roster-card";
import type { CharacterSummary } from "@/components/characters/CharacterCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell } from "@/components/ui/page";
import { buildCharacterRoster, filterRoster, LIBRARY_ROSTER_LAYOUT } from "@/lib/library-roster";
import { springSoft } from "@/lib/motion";
import { cn } from "@/lib/utils";

type LibraryBody = {
  mine: CharacterSummary[];
  liked: CharacterSummary[];
  chats: Array<{
    id: string;
    lastActiveAt?: string;
    character: { id: string; name: string; description?: string | null; avatarUrl?: string | null };
    messages: Array<{ content: string }>;
  }>;
};

const FILTERS = ["all", "favorites", "recent", "custom"] as const;
const STALE_REFRESH_MS = 300_000;

export default function LibraryPage() {
  const [library, setLibrary] = useState<LibraryBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const lastLoadedAt = useRef(0);

  const loadLibrary = useCallback(async () => {
    try {
      const response = await fetch("/api/library", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? "AUTH_REQUIRED" : "LIBRARY_UNAVAILABLE");
      setLibrary(await response.json());
      lastLoadedAt.current = Date.now();
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error && caught.message === "AUTH_REQUIRED" ? "Sign in to view your library." : "Your library could not be loaded. Please try again.");
    }
  }, []);

  useEffect(() => {
    void loadLibrary();

    const refreshWhenStale = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoadedAt.current >= STALE_REFRESH_MS) {
        void loadLibrary();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenStale);
    return () => document.removeEventListener("visibilitychange", refreshWhenStale);
  }, [loadLibrary]);

  const roster = useMemo(() => (library ? buildCharacterRoster(library) : []), [library]);
  const filtered = useMemo(() => filterRoster(roster, query, filter), [roster, query, filter]);

  const toggleFavorite = useCallback(async (characterId: string) => {
    const response = await fetch(`/api/characters/${characterId}/like`, { method: "POST" });
    if (response.ok) await loadLibrary();
  }, [loadLibrary]);

  const deleteCharacter = useCallback(async (characterId: string, characterName: string) => {
    if (!window.confirm(`Delete ${characterName}? This cannot be undone.`)) return;
    const response = await fetch(`/api/characters/${characterId}`, { method: "DELETE" });
    if (response.ok) await loadLibrary();
  }, [loadLibrary]);

  return (
    <PageShell className="relative z-10 space-y-8">
      <PageHeader
        icon={BookMarked}
        title="Character Roster"
        description="Characters you chat with, favorites, and creations."
        actions={
          <GlassButton asChild variant="glass-primary">
            <Link href="/create-character"><Plus className="h-4 w-4" /> Create character</Link>
          </GlassButton>
        }
      />

      <div className="neo-glass-search flex items-center gap-2 px-4 py-2">
        <Search className="h-4 w-4 text-[var(--text-muted)]" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search characters..." className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]" />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button key={item} type="button" onClick={() => setFilter(item)} className={cn("neo-glass-chip px-3 py-1.5 text-xs capitalize", filter === item && "is-active")}>
            {item}
          </button>
        ))}
      </div>

      {error ? (
        <EmptyState
          icon={BookMarked}
          title="Library unavailable"
          description={error}
          action={error.includes("Sign in") ? (
            <GlassButton asChild><Link href="/login">Sign in</Link></GlassButton>
          ) : (
            <GlassButton onClick={() => void loadLibrary()}>Try again</GlassButton>
          )}
        />
      ) : !library ? (
        <div className="skeleton h-64 rounded-[var(--radius-surface)]" />
      ) : filtered.length ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={springSoft} className={cn(LIBRARY_ROSTER_LAYOUT === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-3")}>
          {filtered.map((character) => (
            <CharacterRosterCard
              key={character.id}
              character={character}
              view={LIBRARY_ROSTER_LAYOUT}
              onToggleFavorite={toggleFavorite}
              onDelete={deleteCharacter}
            />
          ))}
        </motion.div>
      ) : (
        <EmptyState
          icon={Compass}
          title="No characters yet"
          description="Discover characters or create your own to fill your roster."
          action={<GlassButton asChild variant="glass-primary"><Link href="/explore">Discover characters</Link></GlassButton>}
        />
      )}
    </PageShell>
  );
}
