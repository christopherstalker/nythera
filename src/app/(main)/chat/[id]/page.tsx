"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { ChatClient } from "@/components/chat/chat-client";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/ui/page";
import type { ChatMessage } from "@/hooks/useChat";

type Chat = {
  id: string;
  summary?: string | null;
  model?: string | null;
  temperature?: number | null;
  character: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
  messages: ChatMessage[];
};

export default function ChatPage({ params }: { params: { id: string } }) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setChat(null);
    setError(null);

    fetch(`/api/chats/${params.id}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((body) => setChat(body.chat))
      .catch((caught) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setError("Chat not found or you are not signed in.");
        }
      });

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
      characterId={chat.character.id}
      characterName={chat.character.name}
      characterAvatarUrl={chat.character.avatarUrl}
      summary={chat.summary}
      model={chat.model}
      temperature={chat.temperature}
      initialMessages={chat.messages}
    />
  );
}
