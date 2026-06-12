"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { KeyRound, Menu, Mic, Paperclip, Plus, SendHorizontal, Settings2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const lastMessage = messages[messages.length - 1]?.content || "No messages yet";

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
    <div className="flex min-h-[calc(100vh-4rem)] bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] border-r border-border bg-card transition-transform duration-300 lg:sticky lg:top-16 lg:z-0 lg:h-[calc(100vh-4rem)] lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col p-4">
          <div className="flex items-center justify-between">
            <p className="text-character text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">Chats</p>
            <button
              type="button"
              aria-label="Close chats"
              className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-primary/10 hover:text-foreground lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Button asChild className="mt-4 w-full rounded-lg">
            <Link href="/explore">
              <Plus className="h-4 w-4" />
              New Chat
            </Link>
          </Button>

          <div className="mt-5 space-y-2">
            <Link
              href={`/chat/${chatId}`}
              className="block rounded-xl border-l-[3px] border-primary bg-primary/10 p-3 no-underline"
            >
              <div className="flex items-start gap-3">
                <Avatar name={characterName} avatarUrl={characterAvatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{characterName}</p>
                  <p className="mt-1 truncate text-[13px] leading-5 text-muted-foreground">{lastMessage}</p>
                </div>
                <span className="text-xs text-muted-foreground">now</span>
              </div>
            </Link>
          </div>

          <div className="mt-auto rounded-2xl border border-border bg-background/55 p-3">
            <KeyRound className="h-4 w-4 text-primary" />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Live providers use encrypted keys from Settings. Local fallback remains available.
            </p>
          </div>
        </div>
      </aside>

      {sidebarOpen ? <button aria-label="Close sidebar overlay" className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setSidebarOpen(false)} /> : null}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open chats"
              className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-primary/10 hover:text-foreground lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <Avatar name={characterName} avatarUrl={characterAvatarUrl} />
            <div>
              <h1 className="text-character text-base font-semibold">{characterName}</h1>
              <p className="text-xs text-muted-foreground">Streaming chat with memory retrieval</p>
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
              <div className="absolute right-0 top-12 z-20 w-[320px] rounded-2xl border border-border bg-card p-4 shadow-card-glow">
                <h2 className="text-sm font-semibold">Chat settings</h2>
                <label className="mt-4 block text-xs font-medium text-muted-foreground">Model</label>
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
                  Use saved provider ids as prefixes, for example openrouter:model or groq:model.
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

        <div className="chat-scroll flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-8 lg:px-12">
          {summary ? (
            <p className="mx-auto max-w-2xl rounded-full border border-border bg-card px-4 py-2 text-center text-xs italic text-muted-foreground">
              {summary}
            </p>
          ) : null}
          {messages.map((message) => (
            <ChatMessageView
              key={message.id}
              role={message.role}
              content={message.content}
              characterName={characterName}
              avatarUrl={characterAvatarUrl}
            />
          ))}
          {error ? <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        </div>

        <form onSubmit={onSubmit} className="shrink-0 border-t border-border bg-background px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-5xl items-end gap-2">
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
              className="max-h-40 min-h-12 flex-1 resize-none rounded-2xl bg-[hsl(var(--input))] py-3"
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
              className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition hover:bg-primary hover:text-white disabled:pointer-events-none disabled:opacity-45"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Avatar({ name, avatarUrl, size = "md" }: { name: string; avatarUrl?: string | null; size?: "sm" | "md" }) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-primary bg-primary/10 text-primary",
        size === "sm" ? "h-10 w-10 text-sm" : "h-11 w-11 text-base"
      )}
    >
      {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="font-bold">{name[0]}</span>}
    </div>
  );
}

function IconButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="focus-ring hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-primary/45 hover:bg-primary/10 hover:text-primary sm:grid"
    >
      {children}
    </button>
  );
}
