"use client";

import { useEffect, useState } from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList } from "@/components/chat/MessageList";
import { TopBar } from "@/components/layout/TopBar";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { useUiStore } from "@/stores/use-ui-store";

type ChatClientProps = {
  chatId: string;
  characterId?: string | null;
  characterName: string;
  characterAvatarUrl?: string | null;
  summary?: string | null;
  model?: string | null;
  temperature?: number | null;
  initialMessages: ChatMessage[];
};

export function ChatClient({ chatId, characterId, characterName, characterAvatarUrl, summary, model: initialModel, temperature: initialTemperature, initialMessages }: ChatClientProps) {
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState(initialModel || "gpt-4o-mini");
  const [temperature, setTemperature] = useState(initialTemperature ?? 0.8);
  const { messages, send, editMessage, deleteMessage, branchFromMessage, isStreaming, error } = useChat(chatId, initialMessages);
  const setActiveChatId = useUiStore((state) => state.setActiveChatId);

  useEffect(() => {
    setActiveChatId(chatId);
    return () => setActiveChatId(null);
  }, [chatId, setActiveChatId]);

  function submitMessage() {
    const content = draft.trim();
    if (!content || isStreaming) {
      return;
    }

    setDraft("");
    void send(content, { model, temperature });
  }

  function regenerate(assistantMessageId: string) {
    const index = messages.findIndex((message) => message.id === assistantMessageId);
    const previousUser = messages
      .slice(0, index >= 0 ? index : messages.length)
      .reverse()
      .find((message) => message.role === "USER");

    if (!previousUser || isStreaming) {
      return;
    }

    void send(previousUser.content, {
      model,
      temperature,
      regenerate: true,
      replaceAssistantId: assistantMessageId
    });
  }

  async function branch(messageId: string) {
    const branchId = await branchFromMessage(messageId);
    if (branchId) {
      window.location.href = `/chat/${branchId}`;
    }
  }

  return (
    <div className="flex h-dvh min-h-dvh flex-col bg-[var(--bg-base)]">
      <TopBar chatId={chatId} characterId={characterId} characterName={characterName} characterAvatarUrl={characterAvatarUrl} />
      <MessageList
        messages={messages}
        characterName={characterName}
        summary={summary}
        error={error}
        onEdit={editMessage}
        onDelete={deleteMessage}
        onRegenerate={regenerate}
        onBranch={branch}
      />
      <ChatInput
        value={draft}
        onChange={setDraft}
        onSubmit={submitMessage}
        disabled={isStreaming}
        model={model}
        temperature={temperature}
        onModelChange={setModel}
        onTemperatureChange={setTemperature}
      />
    </div>
  );
}
