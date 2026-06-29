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
      body: JSON.stringify({ provider: "elevenlabs", text: messageToSpeak.content })
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
    <PageShell variant="chat" className="px-0 md:px-[max(var(--page-padding-x),1.5rem)] lg:px-10">
      <div className="grid h-[calc(100dvh-2rem)] min-h-[680px] overflow-hidden rounded-none border border-transparent bg-transparent md:rounded-[28px] md:border-[var(--border-default)] md:bg-[var(--bg-surface)] md:shadow-[var(--shadow-card)]">
        <header className="flex min-w-0 items-center gap-3 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
          <Button asChild variant="outline" size="icon" aria-label="Back to rooms">
            <Link href="/rooms"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex -space-x-2">
            {room.characters.slice(0, 4).map((link) => (
              <Avatar key={link.characterId} name={link.character.name} src={link.character.avatarUrl} size="sm" className="ring-2 ring-[var(--bg-surface)]" />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-[var(--text-primary)]">{room.title}</h1>
            <p className="truncate text-xs text-[var(--text-muted)]">{room.characters.map((link) => link.character.name).join(", ")}</p>
          </div>
          <Button type="button" variant="outline" size="icon" aria-label="Delete room" onClick={() => void removeRoom()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </header>

        <main className="chat-scroll min-h-0 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mx-auto grid w-full max-w-3xl gap-3">
            {room.messages.map((item) => {
              const isUser = item.role === "USER";
              return (
                <article key={item.id} className={cn("flex gap-3", isUser && "flex-row-reverse")}>
                  {isUser ? (
                    <Avatar name="You" size="sm" />
                  ) : (
                    <Avatar name={item.character?.name} src={item.character?.avatarUrl} size="sm" />
                  )}
                  <div className={cn("min-w-0 max-w-[82%] rounded-[22px] border p-3 shadow-[var(--glass-highlight)]", isUser ? "border-[rgb(var(--accent-rgb)_/.28)] bg-[var(--accent-purple-soft)]" : "border-[var(--border-default)] bg-[var(--bg-input)]")}>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="truncate text-xs font-semibold text-[var(--text-primary)]">{isUser ? "You" : item.character?.name ?? "Room"}</span>
                      {!isUser && item.role === "CHARACTER" ? (
                        <button
                          type="button"
                          onClick={() => void speak(item)}
                          className="focus-ring ml-auto grid h-7 w-7 place-items-center rounded-full text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-[var(--text-primary)]"
                          aria-label={`Play ${item.character?.name ?? "character"} voice`}
                        >
                          {speakingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
                        </button>
                      ) : null}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">{item.content}</p>
                  </div>
                </article>
              );
            })}
            <div ref={endRef} />
          </div>
        </main>

        <form onSubmit={send} className="border-t border-[var(--border-default)] bg-[var(--bg-surface)] p-3 sm:p-4">
          <div className="mx-auto grid w-full max-w-3xl gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <select
                value={speakerId}
                onChange={(event) => setSpeakerId(event.target.value)}
                className="focus-ring glass-input h-11 min-w-0 rounded-[var(--radius-md)] px-3 text-sm sm:w-56"
                aria-label="Next speaker"
              >
                {room.characters.map((link) => (
                  <option key={link.characterId} value={link.characterId}>{link.character.name}</option>
                ))}
              </select>
              <span className="hidden min-w-0 truncate text-xs text-[var(--text-muted)] sm:block">
                Next reply: {selectedSpeaker?.name ?? "auto"}
              </span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Write to the room..."
                className="focus-ring glass-input min-h-[52px] resize-none rounded-[22px] px-4 py-3 text-sm leading-6"
                rows={1}
              />
              <Button type="submit" size="icon" className="h-[52px] w-[52px]" disabled={!message.trim() || sending} aria-label="Send room message">
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>
            {error ? <p className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-secondary)]">{error}</p> : null}
          </div>
        </form>
      </div>
    </PageShell>
  );
}
