"use client";

import { FormEvent, useState } from "react";
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
  const { messages, send, isStreaming, error } = useChat(chatId, initialMessages);
  const lastMessage = messages[messages.length - 1]?.content || "New conversation";

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) {
      return;
    }
    setDraft("");
    void send(content, { model, temperature });
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-transparent">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[296px] border-r border-white/[0.045] bg-background/90 shadow-card-glow backdrop-blur-2xl transition-transform duration-300 lg:sticky lg:top-16 lg:z-0 lg:h-[calc(100vh-4rem)] lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col p-4">
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
          <Button asChild className="mt-4 w-full">
            <Link href="/explore">
              <Plus className="h-4 w-4" />
              New chat
            </Link>
          </Button>

          <div className="mt-5 space-y-2">
            <Link
              href={`/chat/${chatId}`}
              className="block rounded-3xl border border-primary/25 bg-primary/[0.12] p-3 no-underline shadow-inset"
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
            <SurfaceMuted className="p-3">
              <KeyRound className="h-4 w-4 text-primary" />
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Secure model access lives in Settings. Local fallback remains available.
              </p>
            </SurfaceMuted>
            <SurfaceMuted className="p-3">
              <Sparkles className="h-4 w-4 text-[#f0a8c8]" />
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Memory retrieval is added to the prompt when relevant facts are available.
              </p>
            </SurfaceMuted>
          </div>
        </div>
      </aside>

      {sidebarOpen ? <button aria-label="Close sidebar overlay" className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setSidebarOpen(false)} /> : null}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-16 z-20 flex min-h-16 shrink-0 items-center justify-between border-b border-white/[0.045] bg-background/82 px-4 backdrop-blur-2xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open chats"
              className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-white/[0.055] hover:text-foreground lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <CharacterAvatar name={characterName} avatarUrl={characterAvatarUrl} />
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold">{characterName}</h1>
              <p className="truncate text-xs text-muted-foreground">Cozy chat with memory-aware replies</p>
            </div>
          </div>
          <div className="relative">
            <Button
              variant="outline"
              size="icon"
              title="Chat settings"
              aria-label="Chat settings"
              onClick={() => setSettingsOpen((current) => !current)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            {settingsOpen ? (
              <div className="absolute right-0 top-12 z-20 w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-white/[0.055] bg-card/95 p-4 shadow-card-glow backdrop-blur-xl">
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
                  <option value="gemini-1.5-flash" />
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
        </header>

        <div className="chat-scroll flex-1 overflow-y-auto px-4 py-6 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl space-y-5">
            {summary ? (
              <p className="mx-auto max-w-2xl rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-center text-xs italic text-muted-foreground shadow-inset">
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
          </div>
        </div>

        <form onSubmit={onSubmit} className="shrink-0 border-t border-white/[0.045] bg-background/86 px-4 py-4 backdrop-blur-2xl sm:px-6">
          <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-[30px] border border-white/[0.055] bg-card/[0.76] p-2 shadow-card-glow shadow-inset">
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
