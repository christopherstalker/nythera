"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { KeyRound, Menu, MessageCircle, Mic, Paperclip, Plus, SendHorizontal, Settings2, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceMuted } from "@/components/ui/page";
import { CharacterAvatar } from "@/components/character/character-avatar";
import { ChatMessage as ChatMessageView } from "@/components/chat/chat-message";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { cn } from "@/lib/utils";

type ChatClientProps = {
  chatId: string;
  characterName: string;
  characterAvatarUrl?: string | null;
  summary?: string | null;
  initialMessages: ChatMessage[];
};

export function ChatClient({ chatId, characterName, characterAvatarUrl, summary, initialMessages }: ChatClientProps) {
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [temperature, setTemperature] = useState(0.8);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { messages, send, isStreaming, error } = useChat(chatId, initialMessages);
  const lastMessage = messages[messages.length - 1]?.content || "New conversation";
  const backgroundStyle = useMemo(
    () => (characterAvatarUrl ? { backgroundImage: `url(${characterAvatarUrl})` } : undefined),
    [characterAvatarUrl]
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) {
      return;
    }
    setDraft("");
    void send(content, { model, temperature });
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: isStreaming ? "smooth" : "auto", block: "end" });
  }, [messages, isStreaming]);

  return (
    <div className="relative isolate flex min-h-[calc(100dvh-68px)] overflow-hidden bg-background">
      {backgroundStyle ? (
        <div
          aria-hidden="true"
          className="chat-avatar-bg pointer-events-none absolute inset-0 -z-20 scale-110 bg-cover bg-center opacity-[0.12] blur-[56px] saturate-125"
          style={backgroundStyle}
        />
      ) : (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20 hero-gradient opacity-70" />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.11),transparent_38%),linear-gradient(180deg,rgba(9,8,13,0.84),rgba(9,8,13,0.95)_42%,rgba(9,8,13,0.99))]"
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[304px] bg-background/72 shadow-card-glow backdrop-blur-2xl transition-transform duration-300 lg:sticky lg:top-[68px] lg:z-0 lg:h-[calc(100vh-68px)] lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col gap-5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Chats</p>
              <p className="mt-1 text-xs text-muted-foreground">Recent character threads</p>
            </div>
            <button
              type="button"
              aria-label="Close chats"
              className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-white/[0.055] hover:text-foreground lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Button asChild className="w-full">
            <Link href="/explore">
              <Plus className="h-4 w-4" />
              New chat
            </Link>
          </Button>

          <div className="space-y-2">
            <Link
              href={`/chat/${chatId}`}
              className="block rounded-3xl border border-primary/[0.14] bg-primary/[0.09] p-3 no-underline shadow-inset"
            >
              <div className="flex items-start gap-3">
                <CharacterAvatar name={characterName} avatarUrl={characterAvatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{characterName}</p>
                  <p className="mt-1 truncate text-[13px] leading-5 text-muted-foreground">{lastMessage}</p>
                </div>
                <span className="text-xs text-muted-foreground">now</span>
              </div>
            </Link>
          </div>

          <div className="mt-auto space-y-3">
            <SurfaceMuted className="p-4">
              <KeyRound className="h-4 w-4 text-primary" />
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Secure model access lives in Settings. Velora keeps provider keys away from the browser.
              </p>
            </SurfaceMuted>
            <SurfaceMuted className="p-4">
              <Sparkles className="h-4 w-4 text-[#f0a8c8]" />
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Relevant memories can quietly return to the conversation when they matter.
              </p>
            </SurfaceMuted>
          </div>
        </div>
      </aside>

      {sidebarOpen ? <button aria-label="Close sidebar overlay" className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setSidebarOpen(false)} /> : null}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-[68px] z-20 shrink-0 px-4 pt-4 sm:px-6">
          <div className="mx-auto flex min-h-16 max-w-4xl items-center justify-between rounded-full border border-white/[0.025] bg-background/56 px-3 py-2 shadow-card-glow shadow-inset backdrop-blur-2xl sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open chats"
              className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-white/[0.045] hover:text-foreground lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <CharacterAvatar name={characterName} avatarUrl={characterAvatarUrl} />
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold">{characterName}</h1>
              <p className="truncate text-xs text-muted-foreground">Memory-aware conversation</p>
            </div>
          </div>
          <div className="relative">
            <Button
              variant="secondary"
              size="icon"
              title="Chat settings"
              aria-label="Chat settings"
              onClick={() => setSettingsOpen((current) => !current)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            {settingsOpen ? (
              <div className="absolute right-0 top-12 z-20 w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-white/[0.035] bg-card/95 p-5 shadow-card-glow backdrop-blur-xl">
                <h2 className="text-sm font-semibold">Chat settings</h2>
                <label className="mt-4 block text-xs font-medium text-muted-foreground">Preferred model</label>
                <Input
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  list="model-presets"
                  placeholder="openrouter:openai/gpt-4o-mini"
                  className="mt-2"
                />
                <datalist id="model-presets">
                  <option value="gpt-4o-mini" />
                  <option value="gpt-4o" />
                  <option value="claude-3-5-sonnet-latest" />
                  <option value="gemini-2.5-flash" />
                  <option value="openrouter:openai/gpt-4o-mini" />
                  <option value="deepseek:deepseek-chat" />
                  <option value="groq:llama-3.1-8b-instant" />
                  <option value="mistral:mistral-small-latest" />
                  <option value="local-dev-roleplay" />
                </datalist>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Use a saved provider prefix only when you need one, for example openrouter:model.
                </p>
                <label className="mt-4 block text-xs font-medium text-muted-foreground">Creativity: {temperature.toFixed(1)}</label>
                <input
                  value={temperature}
                  onChange={(event) => setTemperature(Number(event.target.value))}
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  className="mt-3 w-full accent-[hsl(var(--primary))]"
                />
                <Button type="button" variant="destructive" className="mt-4 w-full">
                  <Trash2 className="h-4 w-4" />
                  Clear history
                </Button>
              </div>
            ) : null}
          </div>
          </div>
        </header>

        <div className="chat-scroll flex-1 overflow-y-auto px-4 py-8 sm:px-8 lg:px-12" aria-live="polite">
          <div className="mx-auto max-w-4xl space-y-6 pb-4 pt-4">
            {summary ? (
              <p className="mx-auto max-w-2xl rounded-full bg-white/[0.03] px-4 py-2 text-center text-xs italic text-muted-foreground shadow-inset">
                {summary}
              </p>
            ) : null}
            {messages.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title={`Start a chat with ${characterName}`}
                description="Send a first message, ask for a scene, or let the character introduce the world."
                className="mx-auto max-w-2xl"
              />
            ) : (
              messages.map((message) => (
                <ChatMessageView
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  characterName={characterName}
                  avatarUrl={characterAvatarUrl}
                />
              ))
            )}
            {error ? <p className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
            <div ref={bottomRef} aria-hidden="true" />
          </div>
        </div>

        <form onSubmit={onSubmit} className="shrink-0 px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 sm:px-6">
          <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-[30px] border border-white/[0.03] bg-card/[0.72] p-2 shadow-card-glow shadow-inset backdrop-blur-2xl">
            <IconButton label="Attach file">
              <Paperclip className="h-4 w-4" />
            </IconButton>
            <IconButton label="Voice message">
              <Mic className="h-4 w-4" />
            </IconButton>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`Message ${characterName}...`}
              className="max-h-40 min-h-12 flex-1 resize-none border-0 bg-transparent py-3 shadow-none focus:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button
              type="submit"
              disabled={isStreaming || !draft.trim()}
              title="Send message"
              aria-label="Send message"
              className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-full primary-gradient text-white shadow-violet-hover transition hover:-translate-y-0.5 hover:shadow-violet-strong disabled:pointer-events-none disabled:opacity-45"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function IconButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="focus-ring hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[0.055] bg-white/[0.032] text-muted-foreground shadow-inset transition hover:border-primary/25 hover:bg-primary/[0.075] hover:text-primary sm:grid"
    >
      {children}
    </button>
  );
}
