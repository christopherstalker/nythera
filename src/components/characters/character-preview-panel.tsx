"use client";

import { BookmarkSimple, CaretLeft, Check, Sparkle } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { displayTagLabel } from "@/lib/character-tags";
import { cn } from "@/lib/utils";

type DossierChapter = {
  id: string;
  number: string;
  label: string;
};

type CharacterPreviewPanelProps = {
  name: string;
  description: string;
  greeting: string;
  avatarUrl?: string;
  tags: string[];
  generated?: boolean;
  mode?: "create" | "edit";
  completion?: number;
  activeChapter?: string;
  chapters?: DossierChapter[];
  onChapterChange?: (chapter: string) => void;
  className?: string;
  visualIdentity?: {
    accentColor?: string;
    gradientFrom?: string;
    gradientTo?: string;
  };
};

export function CharacterPreviewPanel({
  name,
  description,
  greeting,
  avatarUrl,
  tags,
  generated = false,
  mode = "create",
  completion = 0,
  activeChapter = "identity",
  chapters = [],
  onChapterChange,
  className,
  visualIdentity
}: CharacterPreviewPanelProps) {
  const previewName = name.trim() || "Untitled character";
  const previewDescription = description.trim() || "Their story has not been written yet.";
  const previewGreeting = greeting.trim() || "The first line will be pinned here when the scene is written.";
  const previewTags = tags.length > 0 ? tags : ["roleplay"];
  const accentColor = visualIdentity?.accentColor || visualIdentity?.gradientFrom || "#7bd8c8";

  return (
    <aside className={cn("codex-dossier-sheet", className)} style={{ "--character-accent": accentColor } as React.CSSProperties}>
      <div className="codex-dossier-mobile-bar">
        <button type="button" aria-label="Go back" onClick={() => window.history.back()} className="grid h-9 w-9 place-items-center text-[var(--codex-ivory)]">
          <CaretLeft size={24} weight="thin" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] uppercase tracking-[.28em] text-[var(--codex-mint)]">{mode === "edit" ? "Revision" : "New character"}</p>
          <p className="truncate text-xs uppercase tracking-[.16em] text-[var(--text-muted)]">Draft · {completion}%</p>
        </div>
        <BookmarkSimple size={24} weight="thin" />
      </div>

      <div className="codex-dossier-portrait">
        {avatarUrl ? (
          <img src={avatarUrl} alt={previewName} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[var(--codex-paper-soft)]">
            <Avatar name={previewName} size="xl" className="h-28 w-28 border border-[var(--codex-rule)] bg-transparent font-editorial text-4xl" />
          </div>
        )}
        <div className="codex-dossier-portrait-veil" />
        <div className="codex-dossier-title">
          <div className="flex items-center gap-2">
            <p className="codex-kicker">{generated ? "AI draft ready" : "Living dossier"}</p>
            {generated ? <Sparkle size={13} weight="thin" className="text-[var(--codex-violet)]" /> : null}
          </div>
          <h2>{previewName}</h2>
          <p>{previewDescription}</p>
        </div>
      </div>

      <div className="codex-dossier-scroll chat-scroll">
        <div className="codex-dossier-progress">
          <div>
            <p className="codex-kicker">Manuscript</p>
            <p className="font-editorial mt-1 text-2xl text-[var(--codex-ivory)]">{mode === "edit" ? "Revision in progress" : "Volume in progress"}</p>
          </div>
          <div className="codex-progress-ring" aria-label={`${completion}% complete`} style={{ "--progress": `${completion * 3.6}deg` } as React.CSSProperties}>
            <span>{completion}%</span>
          </div>
        </div>

        <nav className="codex-dossier-index" aria-label="Character manuscript chapters">
          {chapters.map((chapter) => {
            const active = activeChapter === chapter.id;
            return (
              <button key={chapter.id} type="button" onClick={() => onChapterChange?.(chapter.id)} className={cn(active && "is-active")}>
                <span>{chapter.number}</span>
                <p>{chapter.label}</p>
                {active ? <span className="codex-index-mark" /> : completion > 82 ? <Check size={13} /> : null}
              </button>
            );
          })}
        </nav>

        <section className="codex-dossier-facts">
          <p className="codex-kicker">Index terms</p>
          <ul>
            {previewTags.slice(0, 4).map((tag) => <li key={tag}>{displayTagLabel(tag)}</li>)}
          </ul>
        </section>

        <blockquote className="codex-pinned-note">
          <span>Opening leaf</span>
          {previewGreeting}
        </blockquote>
      </div>
    </aside>
  );
}
