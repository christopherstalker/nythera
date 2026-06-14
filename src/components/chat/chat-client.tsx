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

type SavedProviderKey = {
  provider: string;
  defaultModel?: string | null;
  isDefault?: boolean;
};

const APP_DEFAULT_MODELS = new Set(["gpt-4o-mini", "gpt-3.5-turbo"]);

export function ChatClient({ chatId, characterId, characterName, characterAvatarUrl, summary, model: initialModel, temperature: initialTemperature, initialMessages }: ChatClientProps) {
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState(initialModel || "gpt-4o-mini");
  const [activeRouteModel, setActiveRouteModel] = useState<string | null>(null);
  const [manualModelOverride, setManualModelOverride] = useState(false);
  const [temperature, setTemperature] = useState(initialTemperature ?? 0.8);
  const { messages, send, editMessage, deleteMessage, branchFromMessage, isStreaming, error } = useChat(chatId, initialMessages);
  const setActiveChatId = useUiStore((state) => state.setActiveChatId);
  const usesAutoModel = !manualModelOverride && APP_DEFAULT_MODELS.has(model.trim().toLowerCase());
  const visibleModel = usesAutoModel && activeRouteModel ? activeRouteModel : model;

  useEffect(() => {
    setModel(initialModel || "gpt-4o-mini");
    setManualModelOverride(false);
    setActiveRouteModel(null);
  }, [chatId, initialModel]);

  useEffect(() => {
    setActiveChatId(chatId);
    return () => setActiveChatId(null);
  }, [chatId, setActiveChatId]);

  useEffect(() => {
    if (!APP_DEFAULT_MODELS.has(model.trim().toLowerCase())) {
      setActiveRouteModel(null);
      return;
    }

    const controller = new AbortController();
    fetch("/api/keys", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { keys?: SavedProviderKey[] }) => {
        const activeKey = body.keys?.find((key) => key.isDefault) ?? body.keys?.[0];
        if (activeKey?.provider) {
          setActiveRouteModel(`${activeKey.provider}:${activeKey.defaultModel || model}`);
        } else {
          setActiveRouteModel(null);
        }
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setActiveRouteModel(null);
        }
      });

    return () => controller.abort();
  }, [model]);

  function handleModelChange(value: string) {
    setManualModelOverride(true);
    setActiveRouteModel(null);
    setModel(value);
  }

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
        model={visibleModel}
        temperature={temperature}
        onModelChange={handleModelChange}
        onTemperatureChange={setTemperature}
      />
    </div>
  );
}
