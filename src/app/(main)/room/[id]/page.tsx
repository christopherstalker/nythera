"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Send, Trash2, UsersRound, Volume2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page";
import { cn } from "@/lib/utils";

type RoomCharacter = {
  characterId: string;
  position: number;
  character: {
    id: string;
    name: string;
    description?: string | null;
    avatarUrl?: string | null;
  };
};

type RoomMessage = {
  id: string;
  role: "USER" | "CHARACTER" | "SYSTEM";
  content: string;
  createdAt: string;
  character?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  } | null;
};

type Room = {
  id: string;
  storyId?: string | null;
  title: string;
  messageCount: number;
  characters: RoomCharacter[];
  messages: RoomMessage[];
};

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const endRef = useRef<HTMLDivElement | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [message, setMessage] = useState("");
  const [speakerId, setSpeakerId] = useState("");
  const [sending, setSending] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/rooms/${params.id}`, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error ?? "Room not found.");
      return;
    }
    setRoom(body.room);
    setSpeakerId((current) => current || body.room.characters[0]?.characterId || "");
  }, [params.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [room?.messages.length]);

  const selectedSpeaker = useMemo(() => {
    return room?.characters.find((link) => link.characterId === speakerId)?.character ?? null;
  }, [room, speakerId]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !message.trim() || sending) {
      return;
    }

    const optimisticUser: RoomMessage = {
      id: `pending-user-${Date.now()}`,
      role: "USER",
      content: message.trim(),
      createdAt: new Date().toISOString()
    };
    setRoom((current) => current ? { ...current, messages: [...current.messages, optimisticUser] } : current);
    setSending(true);
    setError(null);
    const text = message;
    setMessage("");

    const response = await fetch(`/api/rooms/${room.id}/message`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: text,
        characterId: speakerId || undefined,
        requestId: crypto.randomUUID()
      })
    });
    const body = await response.json().catch(() => null);
    setSending(false);

    if (!response.ok) {
      setError(body?.error ?? "Could not send room message.");
      setRoom((current) => current ? { ...current, messages: current.messages.filter((item) => item.id !== optimisticUser.id) } : current);
      setMessage(text);
      return;
    }

    await refresh();
  }

  async function removeRoom() {
    if (!room) {
      return;
    }
    await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
    router.push("/rooms");
  }

  async function speak(messageToSpeak: RoomMessage) {
    setSpeakingId(messageToSpeak.id);
    setError(null);
    const response = await fetch("/api/voice/synthesize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "elevenlabs",
        text: messageToSpeak.content,
        storyId: room?.storyId || undefined,
        characterId: messageToSpeak.character?.id || undefined
      })
    });
    setSpeakingId(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Voice playback needs a saved ElevenLabs key.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play().catch(() => URL.revokeObjectURL(url));
  }

  if (error && !room) {
    return (
      <PageShell variant="chat">
        <div className="grid min-h-[70vh] place-items-center">
          <div className="glass-panel max-w-md p-6 text-center">
            <UsersRound className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
            <h1 className="mt-3 text-lg font-semibold text-[var(--text-primary)]">Room unavailable</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{error}</p>
            <Button asChild className="mt-4">
              <Link href="/rooms">Back to rooms</Link>
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!room) {
    return (
      <PageShell variant="chat">
        <div className="grid min-h-[70vh] place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell variant="chat" className="!p-0">
      <div className="grid h-dvh min-h-[680px] overflow-hidden bg-[var(--bg-canvas)] md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 border-r border-[var(--border-default)] bg-black/10 px-6 py-7 md:flex md:flex-col">
          <Link href="/rooms" className="codex-kicker inline-flex items-center gap-2 no-underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Ensemble desk
          </Link>
          <p className="codex-kicker mt-12">Room manuscript</p>
          <h1 className="font-editorial mt-3 text-4xl font-medium leading-none text-[var(--text-primary)]">{room.title}</h1>
          <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">{room.messageCount} exchanges across {room.characters.length} voices.</p>
          <div className="mt-10 border-t border-[var(--border-default)]">
            {room.characters.map((link, index) => (
              <button key={link.characterId} type="button" onClick={() => setSpeakerId(link.characterId)} className={cn("focus-ring flex w-full items-center gap-3 border-b border-[var(--border-default)] py-4 text-left", speakerId === link.characterId && "text-[var(--accent-mint)]")}>
                <span className="codex-index">{String(index + 1).padStart(2, "0")}</span>
                <Avatar name={link.character.name} src={link.character.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">{link.character.name}</span>
              </button>
            ))}
          </div>
          <Button type="button" variant="ghost" className="mt-auto justify-start text-[var(--text-muted)]" onClick={() => void removeRoom()}>
            <Trash2 className="h-4 w-4" /> Delete room
          </Button>
        </aside>

        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
          <header className="flex min-w-0 items-center gap-3 border-b border-[var(--border-default)] bg-[var(--bg-surface)]/90 px-4 py-3 backdrop-blur md:px-8">
            <Button asChild variant="ghost" size="icon" className="md:hidden" aria-label="Back to rooms">
              <Link href="/rooms"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div className="flex -space-x-2 md:hidden">
              {room.characters.slice(0, 4).map((link) => (
                <Avatar key={link.characterId} name={link.character.name} src={link.character.avatarUrl} size="sm" className="ring-2 ring-[var(--bg-surface)]" />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="codex-kicker">Live room · {room.characters.length} voices</p>
              <h2 className="font-editorial mt-1 truncate text-xl text-[var(--text-primary)]">{room.title}</h2>
            </div>
            <Button type="button" variant="ghost" size="icon" className="md:hidden" aria-label="Delete room" onClick={() => void removeRoom()}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </header>

          <main className="chat-scroll min-h-0 overflow-y-auto px-4 py-2 sm:px-8">
            <div className="mx-auto w-full max-w-4xl">
              {room.messages.map((item) => {
                const isUser = item.role === "USER";
                return (
                  <article key={item.id} className="grid grid-cols-[34px_minmax(0,1fr)] gap-4 border-b border-[var(--border-default)] py-6 sm:grid-cols-[42px_minmax(0,1fr)] sm:gap-5 sm:py-8">
                    <Avatar name={isUser ? "You" : item.character?.name} src={isUser ? undefined : item.character?.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <div className="mb-2 flex items-center gap-2">
                        <span className={cn("codex-kicker truncate", isUser && "text-[var(--accent-mint)]")}>{isUser ? "You" : item.character?.name ?? "Room"}</span>
                        {!isUser && item.role === "CHARACTER" ? (
                          <button type="button" onClick={() => void speak(item)} className="focus-ring ml-auto grid h-7 w-7 place-items-center text-[var(--text-muted)] hover:text-[var(--text-primary)]" aria-label={`Play ${item.character?.name ?? "character"} voice`}>
                            {speakingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
                          </button>
                        ) : null}
                      </div>
                      <p className="font-editorial whitespace-pre-wrap text-[1.15rem] leading-8 text-[var(--text-secondary)] sm:text-xl">{item.content}</p>
                    </div>
                  </article>
                );
              })}
              <div ref={endRef} />
            </div>
          </main>

          <form onSubmit={send} className="border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 sm:px-8 sm:py-4">
            <div className="mx-auto grid w-full max-w-4xl gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <select value={speakerId} onChange={(event) => setSpeakerId(event.target.value)} className="focus-ring glass-input h-9 min-w-0 border-0 bg-transparent px-0 text-xs uppercase tracking-[.16em] sm:w-56" aria-label="Next speaker">
                  {room.characters.map((link) => <option key={link.characterId} value={link.characterId}>{link.character.name}</option>)}
                </select>
                <span className="hidden min-w-0 truncate text-xs text-[var(--text-muted)] sm:block">Next reply: {selectedSpeaker?.name ?? "auto"}</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-t border-[var(--border-default)] pt-3">
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write what happens next…" className="focus-ring font-editorial min-h-[52px] resize-none border-0 bg-transparent px-1 py-3 text-lg leading-7 outline-none placeholder:italic placeholder:text-[var(--text-muted)]" rows={1} />
                <Button type="submit" size="icon" className="h-[48px] w-[48px] rounded-full" disabled={!message.trim() || sending} aria-label="Send room message">
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
              {error ? <p className="border-l border-[var(--accent-violet)] pl-3 text-sm text-[var(--text-secondary)]">{error}</p> : null}
            </div>
          </form>
        </section>
      </div>
    </PageShell>
  );
}
