"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Ellipsis, Heart, MessageCircle, Pencil, Star, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { Avatar } from "@/components/ui/avatar";
import { GlassButton } from "@/components/ui/GlassButton";
import { cn } from "@/lib/utils";
import { springSoft } from "@/lib/motion";
import type { RosterCharacter } from "@/lib/library-roster";

type CharacterRosterCardProps = {
  character: RosterCharacter;
  view: "grid" | "list";
  onToggleFavorite: (characterId: string) => Promise<void>;
  onDelete: (characterId: string, characterName: string) => Promise<void>;
};

export function CharacterRosterCard({ character, view, onToggleFavorite, onDelete }: CharacterRosterCardProps) {
  if (view === "list") {
    return (
      <motion.article
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSoft}
        className="neo-glass-card group relative grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:gap-4 sm:p-4"
      >
        <span className="relative shrink-0">
          <Avatar name={character.name} src={character.avatarUrl} size="md" />
          <span className={cn("neo-glass-status-dot absolute bottom-0 right-0", character.isRecent ? "is-online" : "is-away")} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-2">
            <p className="line-clamp-2 min-w-0 break-words text-sm font-semibold leading-5 text-[var(--text-primary)]">{character.name}</p>
            {character.isFavorite ? <Star className="h-3.5 w-3.5 shrink-0 fill-amber-300 text-amber-300" /> : null}
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-[var(--text-secondary)]">{character.preview}</p>
        </div>
        {character.lastActive ? <time className="hidden shrink-0 text-[10px] uppercase tracking-wide text-[var(--text-muted)] sm:block">{character.lastActive}</time> : null}
        <div className="flex shrink-0 items-center gap-2">
          <GlassButton asChild variant="glass-secondary" size="icon" aria-label={`Chat with ${character.name}`}>
            <Link href={character.chatId ? `/chat/${character.chatId}` : `/character/${character.id}`}>
              <MessageCircle className="h-4 w-4" />
            </Link>
          </GlassButton>
          <RosterMenu character={character} onToggleFavorite={onToggleFavorite} onDelete={onDelete} />
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={springSoft}
      className="neo-glass-card group relative flex h-full flex-col p-5"
    >
      <span className="relative mx-auto">
        <Avatar name={character.name} src={character.avatarUrl} size="lg" className="h-20 w-20 sm:h-24 sm:w-24" />
        <span className={cn("neo-glass-status-dot absolute bottom-1 right-1", character.isRecent ? "is-online" : "is-away")} />
      </span>
      <h3 className="mt-4 text-center text-base font-semibold text-[var(--text-primary)]">{character.name}</h3>
      <p className="mt-2 line-clamp-2 flex-1 text-center text-xs leading-5 text-[var(--text-secondary)]">{character.preview}</p>
      <div className="mt-5 flex items-center justify-center gap-2">
        <GlassButton asChild variant="glass-primary" size="sm">
          <Link href={character.chatId ? `/chat/${character.chatId}` : `/character/${character.id}`}>
            <MessageCircle className="h-4 w-4" /> Chat
          </Link>
        </GlassButton>
        <RosterMenu character={character} onToggleFavorite={onToggleFavorite} onDelete={onDelete} />
      </div>
    </motion.article>
  );
}

function RosterMenu({ character, onToggleFavorite, onDelete }: Omit<CharacterRosterCardProps, "view">) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeMenu(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <GlassButton
        variant="glass-icon"
        size="icon"
        aria-label={`Menu for ${character.name}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Ellipsis className="h-4 w-4" />
      </GlassButton>
      {open ? (
        <div className="neo-glass-panel absolute bottom-[calc(100%+8px)] right-0 z-30 w-44 p-1.5 text-left">
          <button
            type="button"
            className="nav-item w-full"
            onClick={() => {
              setOpen(false);
              void onToggleFavorite(character.id);
            }}
          >
            <Heart className={cn("h-4 w-4", character.isFavorite && "fill-current text-rose-300")} />
            {character.isFavorite ? "Unfavorite" : "Favorite"}
          </button>
          {character.isCustom ? (
            <>
              <Link href={`/character/${character.id}/edit`} className="nav-item" onClick={() => setOpen(false)}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
              <button
                type="button"
                className="nav-item w-full text-red-300 hover:bg-red-500/10"
                onClick={() => {
                  setOpen(false);
                  void onDelete(character.id, character.name);
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
