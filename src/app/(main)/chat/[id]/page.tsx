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
  character: {
    name: string;
    avatarUrl?: string | null;
  };
  messages: ChatMessage[];
};

export default function ChatPage({ params }: { params: { id: string } }) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/chats/${params.id}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((body) => setChat(body.chat))
      .catch(() => setError("Chat not found or you are not signed in."));
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
      <PageShell>
        <div className="skeleton h-[calc(100vh-10rem)] rounded-[30px]" />
      </PageShell>
    );
  }

  return (
    <ChatClient
      chatId={chat.id}
      characterName={chat.character.name}
      characterAvatarUrl={chat.character.avatarUrl}
      summary={chat.summary}
      initialMessages={chat.messages}
    />
  );
}
