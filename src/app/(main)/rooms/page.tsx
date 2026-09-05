"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, MessageSquarePlus, UsersRound, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, PageShell } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
import { cn } from "@/lib/utils";
import { toChatPreview } from "@/lib/chat-preview";

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roomQuery, setRoomQuery] = useState("");

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setLoadError(null);
    try {
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

      if (!roomsResponse.ok || !publicResponse.ok || !mineResponse.ok) throw new Error();

      const uniqueCharacters = new Map<string, CharacterOption>();
      [...(mineBody.characters ?? []), ...(publicBody.characters ?? [])].forEach((character: CharacterOption) => {
        uniqueCharacters.set(character.id, character);
      });
      setRooms(Array.isArray(roomsBody.rooms) ? roomsBody.rooms : []);
      setCharacters(Array.from(uniqueCharacters.values()).slice(0, 72));
    } catch {
      setLoadError("Could not load rooms and characters. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const filteredCharacters = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return characters;
    }
    return characters.filter((character) =>
      [character.name, character.description].filter(Boolean).join(" ").toLowerCase().includes(needle)
    );
  }, [characters, search]);

  const matchingRooms = rooms.filter((room) =>
    [room.title, ...room.characters.map(({ character }) => character.name)].some((text) =>
      text.toLowerCase().includes(roomQuery.trim().toLowerCase())
    )
  );

  function toggleCharacter(id: string) {
    setSelected((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      return current.length >= 6 ? current : [...current, id];
    });
  }

  async function createRoom() {
    if (creating) return;
    if (selected.length < 2) {
      setStatus("Select at least two characters.");
      return;
    }

    setCreating(true);
    setStatus(null);
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          characterIds: selected,
          title: title.trim() || undefined
        })
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus(body?.error ?? "Could not create room.");
        return;
      }

      router.push(`/room/${body.room.id}`);
    } catch {
      setStatus("Could not create room. Your selected cast is saved here; please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <PageShell className="codex-workspace codex-rooms space-y-10">
      <div className="grid gap-10">
        <PageHeader
          compact
          icon={UsersRound}
          title="Rooms"
          description="Continue a group story or bring a new cast together."
          actions={
            <Button
              onClick={() => {
                document.getElementById("room-builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
                document.getElementById("room-title")?.focus({ preventScroll: true });
              }}
            >
              <MessageSquarePlus className="h-4 w-4" />
              New room
            </Button>
          }
        />

        {loadError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/30 p-4 text-sm"
          >
            <p>{loadError}</p>
            <Button variant="outline" onClick={() => void refresh()}>
              Try again
            </Button>
          </div>
        ) : null}

        <section className="grid min-w-0 border-y border-[var(--border-default)] lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
          <div className="min-w-0 py-7 lg:border-r lg:border-[var(--border-default)] lg:pr-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="codex-kicker">Ensemble desk</p>
                <h2 className="font-editorial mt-2 text-3xl font-medium text-[var(--text-primary)]">Active rooms</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Open an existing cast or start a fresh scene.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <SearchBar value={roomQuery} onChange={setRoomQuery} placeholder="Search rooms or cast…" />
            </div>

            <div className="mt-7 grid border-t border-[var(--border-default)]">
              {loading ? (
                <div className="grid min-h-36 place-items-center border-b border-[var(--border-default)]">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
                </div>
              ) : rooms.length > 0 ? (
                matchingRooms.map((room) => <RoomRow key={room.id} room={room} />)
              ) : (
                <div className="border-b border-[var(--border-default)] py-8 text-sm text-[var(--text-secondary)]">
                  {loadError
                    ? "Your rooms will appear after reconnecting."
                    : "No rooms yet. Choose two to six characters in the cast builder to start."}
                </div>
              )}
            </div>
            {rooms.length > 0 && !matchingRooms.length ? (
              <div className="py-6 text-sm text-[var(--text-secondary)]">
                <p>No matching rooms.</p>
                <Button variant="ghost" onClick={() => setRoomQuery("")}>
                  Clear search
                </Button>
              </div>
            ) : null}
          </div>

          <aside id="room-builder" className="min-w-0 scroll-mt-4 py-7 lg:pl-10">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void createRoom();
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="codex-kicker">New room</p>
                  <h2 className="font-editorial mt-2 text-3xl font-medium text-[var(--text-primary)]">Cast builder</h2>
                  <p role="status" className="mt-1 text-sm text-[var(--text-secondary)]">
                    {selected.length}/6 selected · choose at least 2
                  </p>
                </div>
                <span className="grid h-10 w-10 place-items-center border border-[var(--border-default)] text-[var(--accent-mint)]">
                  <UsersRound className="h-5 w-5" />
                </span>
              </div>
              <label htmlFor="room-title" className="mt-5 block text-sm text-[var(--text-secondary)]">
                Room title <span className="text-[var(--text-muted)]">(optional)</span>
              </label>
              <Input
                id="room-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="A midnight meeting"
                maxLength={120}
                className="mt-2"
              />
              {selected.length ? (
                <div className="mt-4 flex flex-wrap gap-2" aria-label="Selected cast">
                  {characters
                    .filter((character) => selected.includes(character.id))
                    .map((character) => (
                      <button
                        type="button"
                        key={character.id}
                        aria-label={`Remove ${character.name}`}
                        disabled={creating}
                        onClick={() => toggleCharacter(character.id)}
                        className="focus-ring flex min-h-10 max-w-full items-center gap-2 rounded-full border border-[var(--codex-rule)] px-3 text-xs"
                      >
                        <span className="truncate">{character.name}</span>
                        <X className="h-3 w-3 shrink-0" />
                      </button>
                    ))}
                </div>
              ) : null}
              <Input
                type="search"
                aria-label="Search available characters"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search available characters"
                className="mt-4"
              />
              <div className="chat-scroll mt-4 grid max-h-[min(58vh,560px)] overflow-y-auto border-t border-[var(--border-default)] pr-1">
                {filteredCharacters.map((character) => {
                  const active = selected.includes(character.id);
                  return (
                    <button
                      type="button"
                      key={character.id}
                      onClick={() => toggleCharacter(character.id)}
                      aria-pressed={active}
                      disabled={creating || (!active && selected.length >= 6)}
                      className={cn(
                        "focus-ring flex min-w-0 items-center gap-3 border-b border-[var(--border-default)] px-1 py-3 text-left transition disabled:opacity-40",
                        active ? "bg-[var(--accent-purple-soft)]" : "hover:bg-white/[0.035]"
                      )}
                    >
                      <Avatar name={character.name} src={character.avatarUrl} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--text-primary)]">
                          {character.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                          {toChatPreview(character.description || "Character")}
                        </span>
                      </span>
                      {active ? <Check className="h-4 w-4 text-[var(--accent-purple)]" /> : null}
                    </button>
                  );
                })}
                {!filteredCharacters.length && !loading ? (
                  <p className="py-5 text-sm text-[var(--text-muted)]">
                    {search ? "No characters match this search." : "No characters available yet."}
                  </p>
                ) : null}
              </div>
              <Button
                type="submit"
                className="mt-5 w-full"
                disabled={selected.length < 2 || creating || loading || Boolean(loadError)}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
                {creating
                  ? "Creating room…"
                  : `Create room${selected.length ? ` · ${selected.length} ${selected.length === 1 ? "character" : "characters"}` : ""}`}
              </Button>
              {status ? (
                <p
                  role="alert"
                  className="mt-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-secondary)]"
                >
                  {status}
                </p>
              ) : null}
            </form>
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
    <Link
      href={`/room/${room.id}`}
      className="group grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--border-default)] py-5 no-underline transition hover:bg-white/[0.025]"
    >
      <div className="flex -space-x-2">
        {room.characters.slice(0, 3).map((link) => (
          <Avatar
            key={link.character.id}
            name={link.character.name}
            src={link.character.avatarUrl}
            size="sm"
            className="ring-2 ring-[var(--bg-input)]"
          />
        ))}
      </div>
      <span className="min-w-0 flex-1">
        <span className="font-editorial block truncate text-xl font-medium text-[var(--text-primary)]">
          {room.title}
        </span>
        <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">{cast}</span>
        <span className="mt-1 block truncate text-xs text-[var(--text-secondary)]">{toChatPreview(preview)}</span>
        <span className="mt-2 block text-xs text-[var(--text-muted)]">
          {room.messageCount} messages ·{" "}
          <time dateTime={room.lastActiveAt}>
            {new Date(room.lastActiveAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </time>
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--accent-purple)]" />
    </Link>
  );
}
