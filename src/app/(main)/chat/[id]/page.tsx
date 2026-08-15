"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { ChatClient } from "@/components/chat/chat-client";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/ui/page";
import type { ChatMessage } from "@/hooks/useChat";

type Chat = {
  id: string;
  chapterNumber: number;
  summary?: string | null;
  model?: string | null;
  temperature?: number | null;
  responsePrompt?: string | null;
  chatMode?: string | null;
  translationLanguage?: string | null;
  appearance?: unknown;
  activeAssistantMessageId?: string | null;
  character: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    visualIdentity?: unknown;
    lorebook?: unknown;
  };
  messages: ChatMessage[];
};

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const [chat, setChat] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setChat(null);
    setError(null);

    async function loadChat() {
      try {
        const response = await fetch(`/api/chats/${params.id}`, { signal: controller.signal });
        if (response.status === 403) {
          const body = await response.json().catch(() => null);
          if (typeof body?.error === "string" && body.error.includes("Adult consent")) {
            window.location.assign(`/auth/new-user?callbackUrl=${encodeURIComponent(`/chat/${params.id}`)}`);
            return;
          }
        }
        if (!response.ok) {
          setError("Chat not found or you are not signed in.");
          return;
        }

        const body = await response.json();
        setChat(body.chat);
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setError("Chat not found or you are not signed in.");
        }
      }
    }

    void loadChat();

    return () => controller.abort();
  }, [params.id]);

  if (error) {
    return (
      <PageShell>
        <EmptyState icon={MessageCircle} title="Chat unavailable" description={error} />
      </PageShell>
    );
  }

  if (!chat) {
    return (
      <div className="flex h-dvh min-h-dvh flex-col bg-[var(--bg-base)]">
        <div className="h-14 border-b border-[var(--border-default)] bg-[var(--bg-base)]" />
        <div className="chat-scroll flex-1 px-4 py-4">
          <div className="mx-auto max-w-[900px] space-y-4">
            <div className="skeleton h-20 w-3/4" />
            <div className="skeleton ml-auto h-16 w-2/3" />
            <div className="skeleton h-24 w-4/5" />
          </div>
        </div>
        <div className="px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-2 md:pb-4">
          <div className="mx-auto h-16 max-w-[900px] rounded-2xl bg-[var(--bg-input)]" />
        </div>
      </div>
    );
  }

  return (
    <ChatClient
      key={chat.id}
      chatId={chat.id}
      chapterNumber={chat.chapterNumber}
      characterId={chat.character.id}
      characterName={chat.character.name}
      characterAvatarUrl={chat.character.avatarUrl}
      summary={chat.summary}
      model={chat.model}
      temperature={chat.temperature}
      responsePrompt={chat.responsePrompt}
      chatMode={chat.chatMode}
      translationLanguage={chat.translationLanguage}
      appearance={chat.appearance}
      characterBackgroundUrl={getCharacterBackgroundUrl(chat.character.visualIdentity)}
      characterLorebook={chat.character.lorebook}
      initialMessages={chat.messages}
      initialActiveAssistantMessageId={chat.activeAssistantMessageId}
    />
  );
}

function getCharacterBackgroundUrl(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const background = (value as Record<string, unknown>).chatBackground;
  return typeof background === "string" && /^(?:https?:\/\/|data:image\/)/i.test(background) ? background : null;
}
