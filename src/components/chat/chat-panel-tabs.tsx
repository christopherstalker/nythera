"use client";

import Link from "next/link";
import { Check, ImagePlus, Plus, Upload } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ImageFilePicker } from "@/components/ui/image-file-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useChatQuickPanel } from "@/hooks/use-chat-quick-panel";
import { cn } from "@/lib/utils";

type PanelState = ReturnType<typeof useChatQuickPanel>;

export function PersonaTabContent({ panel, compact = false }: { panel: PanelState; compact?: boolean }) {
  return (
    <div className="grid gap-3">
      <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
        {panel.profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            onClick={() => void panel.switchPersona(profile)}
            className={cn(
              "focus-ring flex h-11 shrink-0 items-center gap-2 rounded-2xl border px-3 text-left text-xs transition-colors",
              panel.activeProfileId === profile.id
                ? "border-transparent bg-[var(--accent-purple-soft)] text-[var(--text-primary)]"
                : "border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-secondary)]"
            )}
          >
            <Avatar name={profile.displayName} src={profile.avatarUrl} size="xs" />
            <span className="max-w-28 truncate">{profile.label || profile.displayName}</span>
            {panel.activeProfileId === profile.id ? <Check className="h-3.5 w-3.5 text-[var(--accent-purple)]" /> : null}
          </button>
        ))}
        <button
          type="button"
          onClick={panel.startNewPersona}
          className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          aria-label="Add persona"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={panel.savePersona} className="grid gap-2">
        {!compact ? <Input value={panel.draft.label} onChange={(event) => panel.updateDraft("label", event.target.value)} placeholder="Profile label" /> : null}
        <Input value={panel.draft.displayName} onChange={(event) => panel.updateDraft("displayName", event.target.value)} placeholder="Your roleplay name" required />
        <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
          <ImageFilePicker
            onPick={panel.pickAvatar}
            onError={panel.setAvatarPickError}
            onUploadingChange={panel.setAvatarUploadingState}
            className="focus-ring grid h-[72px] place-items-center overflow-hidden rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--accent-purple)] transition hover:border-[var(--accent-purple)] hover:bg-white/[0.045]"
          >
            {panel.draft.avatarUrl ? <img src={panel.draft.avatarUrl} alt="" className="h-full w-full object-cover" /> : <Upload className="h-5 w-5" />}
          </ImageFilePicker>
          <div className="grid content-center gap-2">
            <p className="text-xs leading-5 text-[var(--text-secondary)]">
              {panel.avatarUploading ? "Processing photo..." : "Tap the square to upload a photo from your gallery."}
            </p>
            {panel.draft.avatarUrl ? (
              <button
                type="button"
                onClick={() => panel.updateDraft("avatarUrl", "")}
                className="focus-ring inline-flex h-8 items-center justify-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-xs text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Clear photo
              </button>
            ) : null}
          </div>
        </div>
        <Textarea value={panel.draft.summary} onChange={(event) => panel.updateDraft("summary", event.target.value)} placeholder="Who you are in this chat." required className="min-h-20" />
        {!compact ? (
          <>
            <Textarea value={panel.draft.background} onChange={(event) => panel.updateDraft("background", event.target.value)} placeholder="Background or current situation." className="min-h-20" />
            <Textarea value={panel.draft.traits} onChange={(event) => panel.updateDraft("traits", event.target.value)} placeholder="Traits, one per line" className="min-h-16" />
          </>
        ) : null}
        <Button type="submit" disabled={!panel.draft.displayName.trim() || !panel.draft.summary.trim() || panel.avatarUploading}>
          <Check className="h-4 w-4" />
          Save persona
        </Button>
      </form>
      {panel.personaStatus ? <PanelStatusText>{panel.personaStatus}</PanelStatusText> : null}
    </div>
  );
}

export function MemoryTabContent({ panel }: { panel: PanelState }) {
  return (
    <div className="grid gap-3">
      <form onSubmit={panel.addMemory} className="grid gap-2">
        <Textarea value={panel.memoryDraft} onChange={(event) => panel.setMemoryDraft(event.target.value)} placeholder="Add a fact, preference, boundary, or scene detail." className="min-h-28" />
        <Button type="submit" disabled={!panel.memoryDraft.trim()}>
          <Plus className="h-4 w-4" />
          Add memory
        </Button>
      </form>
      {panel.memoryStatus ? <PanelStatusText>{panel.memoryStatus}</PanelStatusText> : null}
      <div className="grid gap-2">
        {panel.memories.map((memory) => (
          <div key={memory.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 shadow-[var(--glass-highlight)]">
            <p className="text-sm leading-5 text-[var(--text-primary)]">{memory.content}</p>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {memory.category}
              {memory.pinned ? " - pinned" : ""}
            </p>
          </div>
        ))}
        {panel.memories.length === 0 ? <PanelStatusText>No memories for this character yet.</PanelStatusText> : null}
      </div>
    </div>
  );
}

export function HistoryTabContent({ panel, chatId, onNavigate }: { panel: PanelState; chatId: string; onNavigate?: () => void }) {
  return (
    <div className="grid gap-2">
      {panel.chats.map((chat) => (
        <Link
          key={chat.id}
          href={`/chat/${chat.id}`}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 no-underline shadow-[var(--glass-highlight)] transition-colors hover:bg-white/[0.055]",
            chat.id === chatId && "border-[rgb(var(--accent-rgb)_/_0.38)] bg-[var(--accent-purple-soft)]"
          )}
        >
          <Avatar name={chat.character.name} src={chat.character.avatarUrl} size="xs" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-[var(--text-primary)]">{chat.title || chat.character.name}</span>
            <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{chat.character.description || chat.messages[0]?.content || "Continue chat"}</span>
          </span>
        </Link>
      ))}
      {panel.chats.length === 0 ? <PanelStatusText>No chat history yet.</PanelStatusText> : null}
    </div>
  );
}

export function PanelStatusText({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 text-sm leading-5 text-[var(--text-secondary)] shadow-[var(--glass-highlight)]">
      {children}
    </p>
  );
}
