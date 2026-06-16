"use client";

import { useEffect, useState } from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatComposerSheet } from "@/components/chat/chat-composer-sheet";
import { MessageList } from "@/components/chat/MessageList";
import { ChatQuickPanel } from "@/components/chat/chat-quick-panel";
import { TopBar } from "@/components/layout/TopBar";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { useChatQuickPanel } from "@/hooks/use-chat-quick-panel";
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
  const [quickPanelOpen, setQuickPanelOpen] = useState(false);
  const [composerSheetOpen, setComposerSheetOpen] = useState(false);
  const quickPanel = useChatQuickPanel({ chatId, characterId, enabled: true });
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
    setQuickPanelOpen(window.matchMedia("(min-width: 1280px)").matches);
  }, [chatId]);

  useEffect(() => {
    // Streaming state subtly raises brand glow without changing chat/proxy behavior.
    window.dispatchEvent(new CustomEvent("nythera:brand-state", { detail: { glowIntensity: isStreaming ? 0.84 : 0.56 } }));
    return () => {
      window.dispatchEvent(new CustomEvent("nythera:brand-state", { detail: { glowIntensity: 0.56 } }));
    };
  }, [isStreaming]);

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
    <div className="relative isolate flex h-dvh min-h-dvh flex-col overflow-hidden bg-[var(--bg-base)]">
      {characterAvatarUrl ? (
        <img
          src={characterAvatarUrl}
          alt=""
          className="pointer-events-none absolute inset-0 -z-20 h-full w-full scale-110 object-cover opacity-24 blur-3xl"
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--chat-overlay)" }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-52 bg-gradient-to-b from-primary/[0.11] to-transparent" />
      <div className="shrink-0 px-2 pt-2 sm:px-3 sm:pt-3">
        <TopBar
          chatId={chatId}
          characterId={characterId}
          characterName={characterName}
          characterAvatarUrl={characterAvatarUrl}
          onOpenQuickPanel={() => setQuickPanelOpen(true)}
          showQuickPanelButton
        />
      </div>
      {quickPanelOpen ? (
        <button
          type="button"
          aria-label="Close quick panel overlay"
          onClick={() => setQuickPanelOpen(false)}
          className="fixed inset-0 z-30 bg-black/35 backdrop-blur-[2px] xl:hidden"
        />
      ) : null}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-2 px-2 pb-0 sm:gap-3 md:flex-row md:px-3 md:pb-3">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
            personaName={quickPanel.activePersona?.displayName}
            personaAvatarUrl={quickPanel.activePersona?.avatarUrl}
            onOpenComposer={() => setComposerSheetOpen(true)}
          />
        </section>
        <ChatQuickPanel
          chatId={chatId}
          open={quickPanelOpen}
          onClose={() => setQuickPanelOpen(false)}
          panel={quickPanel}
        />
      </div>
      <ChatComposerSheet
        open={composerSheetOpen}
        onClose={() => setComposerSheetOpen(false)}
        chatId={chatId}
        panel={quickPanel}
      />
    </div>
  );
}
