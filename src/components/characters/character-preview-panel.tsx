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
  const accentColor = visualIdentity?.accentColor || visualIdentity?.gradientFrom || "#8F81F7";

  return (
    <aside className={cn("chat-scroll overflow-y-auto lg:sticky lg:top-0 lg:max-h-[calc(100svh-var(--page-padding-y)*2)]", className)}>
      <div className="mx-auto grid w-full max-w-[390px] gap-4 lg:max-w-none">
        {generated ? (
          <div className="mb-3 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[rgb(var(--accent-rgb)_/_0.35)] bg-[var(--accent-purple-soft)] px-3 py-1 text-xs font-medium text-[var(--text-primary)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent-purple)]" />
            AI preview ready
          </div>
        ) : null}

        <div className="relative overflow-hidden rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface)]">
          <div className="relative aspect-video">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-[var(--bg-elevated)]" style={{ borderBottom: `3px solid ${accentColor}` }}>
                <Avatar name={previewName} size="xl" className="h-28 w-28 bg-[var(--accent-purple-soft)]" />
              </div>
            )}
            <div className="absolute inset-0 bg-[color:oklch(var(--color-canvas)/.42)]" />
          </div>
          <div className="px-4 py-4">
            <p className="truncate text-base font-semibold tracking-tight text-white">{previewName}</p>
            <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">@you</p>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{previewDescription}</p>
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{previewName}</p>
          <p className="mt-1 line-clamp-4 text-xs leading-5 text-[var(--text-secondary)]">{previewDescription}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {previewTags.slice(0, 6).map((tag) => (
              <Badge key={tag}>{displayTagLabel(tag)}</Badge>
            ))}
          </div>
        </div>

        <div className="bubble-char max-w-full text-sm leading-6">{previewGreeting}</div>
      </div>
    </aside>
  );
}
