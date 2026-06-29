"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, MessageSquarePlus, UsersRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, PageShell } from "@/components/ui/page";
import { cn } from "@/lib/utils";

type CharacterOption = {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
};

type RoomSummary = {
  id: string;
  title: string;
  messageCount: number;
  lastActiveAt: string;
  characters: Array<{ character: CharacterOption }>;
  messages: Array<{
    content: string;
    role: string;
    character?: { name: string; avatarUrl?: string | null } | null;
  }>;
};

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    const [roomsResponse, publicResponse, mineResponse] = await Promise.all([
      fetch("/api/rooms", { cache: "no-store" }),
      fetch("/api/characters?take=50&sort=top-rated&nsfw=include", { cache: "no-store" }),
      fetch("/api/characters?mine=true&take=50", { cache: "no-store" })
    ]);

    const [roomsBody, publicBody, mineBody] = await Promise.all([
      roomsResponse.ok ? roomsResponse.json() : Promise.resolve({ rooms: [] }),
      publicResponse.ok ? publicResponse.json() : Promise.resolve({ characters: [] }),
      mineResponse.ok ? mineResponse.json() : Promise.resolve({ characters: [] })
    ]);

    const uniqueCharacters = new Map<string, CharacterOption>();
    [...(mineBody.characters ?? []), ...(publicBody.characters ?? [])].forEach((character: CharacterOption) => {
      uniqueCharacters.set(character.id, character);
    });
    setRooms(Array.isArray(roomsBody.rooms) ? roomsBody.rooms : []);
    setCharacters(Array.from(uniqueCharacters.values()).slice(0, 72));
    setLoading(false);
  }

  const filteredCharacters = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return characters;
    }
    return characters.filter((character) => [character.name, character.description].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [characters, search]);

  function toggleCharacter(id: string) {
    setSelected((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      return current.length >= 6 ? current : [...current, id];
    });
  }

  async function createRoom() {
    if (selected.length < 2) {
      setStatus("Select at least two characters.");
      return;
    }

    setCreating(true);
    setStatus(null);
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        characterIds: selected,
        title: title.trim() || undefined
      })
    });
    setCreating(false);

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setStatus(body?.error ?? "Could not create room.");
      return;
    }

    router.push(`/room/${body.room.id}`);
  }

  return (
    <PageShell>
      <div className="grid gap-6">
        <PageHeader
          icon={UsersRound}
          title="Rooms"
          description="Build a group scene with multiple characters, rotating speakers, and the same persona and memory context used in chats."
          actions={
            <Button onClick={() => void createRoom()} disabled={selected.length < 2 || creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
              Create room
            </Button>
          }
        />

        <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="glass-panel min-w-0 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Active rooms</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Open an existing cast or start a fresh scene.</p>
              </div>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional room title" className="sm:max-w-xs" />
            </div>

            <div className="mt-4 grid gap-3">
              {loading ? (
                <div className="grid min-h-36 place-items-center rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-input)]">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
                </div>
              ) : rooms.length > 0 ? (
                rooms.map((room) => <RoomRow key={room.id} room={room} />)
              ) : (
                <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-input)] p-6 text-sm text-[var(--text-secondary)]">
                  No rooms yet. Select characters from the builder and create your first room.
                </div>
              )}
            </div>
          </div>

          <aside className="glass-panel min-w-0 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Cast builder</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{selected.length}/6 selected</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-md)] bg-[var(--accent-purple-soft)] text-[var(--accent-purple)]">
                <UsersRound className="h-5 w-5" />
              </span>
            </div>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search characters" className="mt-4" />
            <div className="chat-scroll mt-3 grid max-h-[min(58vh,560px)] gap-2 overflow-y-auto pr-1">
              {filteredCharacters.map((character) => {
                const active = selected.includes(character.id);
                return (
                  <button
                    type="button"
                    key={character.id}
                    onClick={() => toggleCharacter(character.id)}
                    className={cn(
                      "focus-ring flex min-w-0 items-center gap-3 rounded-[var(--radius-md)] border p-3 text-left transition",
                      active ? "border-[rgb(var(--accent-rgb)_/.38)] bg-[var(--accent-purple-soft)]" : "border-[var(--border-default)] bg-[var(--bg-input)] hover:bg-white/[0.055]"
                    )}
                  >
                    <Avatar name={character.name} src={character.avatarUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--text-primary)]">{character.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{character.description || "Character"}</span>
                    </span>
                    {active ? <Check className="h-4 w-4 text-[var(--accent-purple)]" /> : null}
                  </button>
                );
              })}
            </div>
            {status ? <p className="mt-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-secondary)]">{status}</p> : null}
          </aside>
        </section>
      </div>
    </PageShell>
  );
}

function RoomRow({ room }: { room: RoomSummary }) {
  const preview = room.messages[0]?.content ?? "The room is ready.";
  const cast = room.characters.map((link) => link.character.name).join(", ");

  return (
    <Link href={`/room/${room.id}`} className="group flex min-w-0 items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-input)] p-3 no-underline transition hover:border-[rgb(var(--accent-rgb)_/.32)] hover:bg-white/[0.055]">
      <div className="flex -space-x-2">
        {room.characters.slice(0, 3).map((link) => (
          <Avatar key={link.character.id} name={link.character.name} src={link.character.avatarUrl} size="sm" className="ring-2 ring-[var(--bg-input)]" />
        ))}
      </div>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{room.title}</span>
        <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">{cast}</span>
        <span className="mt-1 block truncate text-xs text-[var(--text-secondary)]">{preview}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--accent-purple)]" />
    </Link>
  );
}
