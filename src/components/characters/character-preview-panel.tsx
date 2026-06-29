"use client";

import { Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { displayTagLabel } from "@/lib/character-tags";
import { cn } from "@/lib/utils";

type CharacterPreviewPanelProps = {
  name: string;
  description: string;
  greeting: string;
  avatarUrl?: string;
  tags: string[];
  generated?: boolean;
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
  className,
  visualIdentity
}: CharacterPreviewPanelProps) {
  const previewName = name.trim() || "Character name";
  const previewDescription = description.trim() || "Short description will appear here.";
  const previewGreeting = greeting.trim() || "Your greeting appears here.";
  const previewTags = tags.length > 0 ? tags : ["roleplay"];
  const gradientFrom = visualIdentity?.gradientFrom || visualIdentity?.accentColor || "#8F81F7";
  const gradientTo = visualIdentity?.gradientTo || "#6FE7D2";

  return (
    <aside className={cn("lg:sticky lg:top-6", className)}>
      <div className="glass-panel mx-auto w-full max-w-[390px] p-4">
        {generated ? (
          <div className="mb-3 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[rgb(var(--accent-rgb)_/_0.35)] bg-[var(--accent-purple-soft)] px-3 py-1 text-xs font-medium text-[var(--text-primary)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent-purple)]" />
            AI preview ready
          </div>
        ) : null}

        <div className="relative h-[300px] overflow-hidden rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-elevated)]">
          <div className="relative h-[68%]">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center" style={{ background: `linear-gradient(145deg, ${gradientFrom}, ${gradientTo})` }}>
                <Avatar name={previewName} size="xl" className="h-28 w-28 bg-[var(--accent-purple-soft)]" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0b0b12]/75" />
          </div>
          <div className="px-4 py-3">
            <p className="truncate text-base font-semibold tracking-tight text-white">{previewName}</p>
            <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">@you</p>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{previewDescription}</p>
          </div>
        </div>

        <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-input)] p-4 shadow-[var(--glass-highlight)] backdrop-blur-xl">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{previewName}</p>
          <p className="mt-1 line-clamp-4 text-xs leading-5 text-[var(--text-secondary)]">{previewDescription}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {previewTags.slice(0, 6).map((tag) => (
              <Badge key={tag}>{displayTagLabel(tag)}</Badge>
            ))}
          </div>
        </div>

        <div className="mt-3 bubble-char max-w-full text-sm leading-6">{previewGreeting}</div>
      </div>
    </aside>
  );
}
