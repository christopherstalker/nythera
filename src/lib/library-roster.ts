import { toChatPreview } from "@/lib/chat-preview";
import type { CharacterSummary } from "@/components/characters/CharacterCard";

export type RosterCharacter = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  preview: string;
  chatId?: string;
  isFavorite: boolean;
  isCustom: boolean;
  isRecent: boolean;
  lastActive?: string;
  glowColor?: string;
};

type LibraryChat = {
  id: string;
  lastActiveAt?: string | Date;
  character: { id: string; name: string; description?: string | null; avatarUrl?: string | null };
  messages: Array<{ content: string }>;
};

export function buildCharacterRoster(input: {
  mine: CharacterSummary[];
  liked: CharacterSummary[];
  chats: LibraryChat[];
}): RosterCharacter[] {
  const map = new Map<string, RosterCharacter>();

  for (const chat of input.chats) {
    if (map.has(chat.character.id)) {
      continue;
    }
    const preview = toChatPreview(chat.messages.at(-1)?.content || chat.character.description || "No messages yet");
    map.set(chat.character.id, {
      id: chat.character.id,
      name: chat.character.name,
      avatarUrl: chat.character.avatarUrl,
      preview,
      chatId: chat.id,
      isFavorite: false,
      isCustom: false,
      isRecent: true,
      lastActive: formatLastActive(chat.lastActiveAt),
      glowColor: "rgba(99,102,241,0.15)"
    });
  }

  for (const character of input.liked) {
    const existing = map.get(character.id);
    map.set(character.id, {
      id: character.id,
      name: character.name,
      avatarUrl: character.avatarUrl,
      preview: existing?.preview ?? character.description ?? "Favorite character",
      chatId: existing?.chatId,
      isFavorite: true,
      isCustom: false,
      isRecent: existing?.isRecent ?? false,
      lastActive: existing?.lastActive,
      glowColor: "rgba(251,191,36,0.15)"
    });
  }

  for (const character of input.mine) {
    const existing = map.get(character.id);
    map.set(character.id, {
      id: character.id,
      name: character.name,
      avatarUrl: character.avatarUrl,
      preview: existing?.preview ?? character.description ?? "Your character",
      chatId: existing?.chatId,
      isFavorite: existing?.isFavorite ?? false,
      isCustom: true,
      isRecent: existing?.isRecent ?? false,
      lastActive: existing?.lastActive,
      glowColor: "rgba(139,92,246,0.15)"
    });
  }

  return [...map.values()].sort((a, b) => Number(b.isRecent) - Number(a.isRecent) || a.name.localeCompare(b.name));
}

function formatLastActive(value?: string | Date) {
  if (!value) return undefined;
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (elapsedMinutes < 1) return "Now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h`;
  const elapsedDays = Math.round(elapsedHours / 24);
  return elapsedDays < 7 ? `${elapsedDays}d` : new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function filterRoster(roster: RosterCharacter[], query: string, filter: "all" | "favorites" | "recent" | "custom") {
  const normalized = query.trim().toLowerCase();
  return roster.filter((character) => {
    if (filter === "favorites" && !character.isFavorite) return false;
    if (filter === "recent" && !character.isRecent) return false;
    if (filter === "custom" && !character.isCustom) return false;
    if (!normalized) return true;
    return character.name.toLowerCase().includes(normalized) || character.preview.toLowerCase().includes(normalized);
  });
}
