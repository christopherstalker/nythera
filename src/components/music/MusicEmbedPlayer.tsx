"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Music2, Pause, Play, X } from "lucide-react";
import { resolveMusicEmbed, type MusicSettings } from "@/lib/music-embed";
import { cn } from "@/lib/utils";

export function MusicEmbedPlayer({ music, compact = false, className }: { music?: MusicSettings | null; compact?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const embed = music?.enabled ? resolveMusicEmbed(music.url) : null;
  const title = music?.title || "Soundtrack";

  useEffect(() => {
    setOpen(false);
  }, [music?.url]);

  if (!embed) {
    return null;
  }

  return (
    <section className={cn("overflow-hidden rounded-sm border border-white/15 bg-black/80", className)} aria-label="Musical accompaniment">
      <div className="flex min-h-11 items-center gap-3 px-3 py-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 text-[var(--codex-mint)]">
          <Music2 className="h-4 w-4" />
        </span>
        <button type="button" onClick={() => setOpen((current) => !current)} className="focus-ring min-w-0 flex-1 text-left">
          <span className="block truncate text-xs font-semibold text-[var(--text-primary)]">{title}</span>
          <span className="mt-0.5 block text-[10px] uppercase tracking-[.12em] text-[var(--text-muted)]">{embed.providerLabel} · {open ? "player open" : "tap to play"}</span>
        </button>
        <a href={embed.sourceUrl} target="_blank" rel="noopener noreferrer" className="focus-ring grid h-8 w-8 shrink-0 place-items-center text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label={`Open in ${embed.providerLabel}`}>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button type="button" onClick={() => setOpen((current) => !current)} className="focus-ring grid h-8 w-8 shrink-0 place-items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]" aria-label={open ? "Close music player" : "Open music player"}>
          {open ? (compact ? <X className="h-4 w-4" /> : <Pause className="h-4 w-4" />) : <Play className="h-4 w-4" />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-white/10 bg-black">
          <iframe
            src={embed.embedUrl}
            title={`${embed.providerLabel} player: ${title}`}
            loading="lazy"
            allow="autoplay; encrypted-media; clipboard-write; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
            referrerPolicy="strict-origin-when-cross-origin"
            className={cn("block w-full border-0", embed.aspect === "video" ? "aspect-video min-h-[200px]" : "h-[166px]", compact && embed.aspect === "audio" && "h-[152px]")}
          />
        </div>
      ) : null}
    </section>
  );
}
