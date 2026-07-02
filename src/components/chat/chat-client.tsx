"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList } from "@/components/chat/MessageList";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { buildProviderModelGroups, inferProviderModelValue, type ProviderModelGroup, type SavedProviderSummary } from "@/lib/provider-model-options";
import { useUiStore } from "@/stores/use-ui-store";

type ChatClientProps = {
  chatId: string;
  characterId?: string | null;
  characterName: string;
  characterAvatarUrl?: string | null;
  summary?: string | null;
  model?: string | null;
  temperature?: number | null;
  responsePrompt?: string | null;
  initialMessages: ChatMessage[];
};

export function ChatClient({ chatId, characterId, characterName, characterAvatarUrl, summary, model: initialModel, temperature: initialTemperature, responsePrompt: initialResponsePrompt, initialMessages }: ChatClientProps) {
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState(initialModel || "gpt-4o-mini");
  const [temperature, setTemperature] = useState(initialTemperature ?? 0.7);
  const [responsePrompt, setResponsePrompt] = useState(initialResponsePrompt ?? "");
  const [apiSaveStatus, setApiSaveStatus] = useState<string | null>(null);
  const [providerKeys, setProviderKeys] = useState<SavedProviderSummary[]>([]);
  const [providerKeysLoading, setProviderKeysLoading] = useState(true);
  const persistedApiRef = useRef({ model: initialModel || "gpt-4o-mini", temperature: initialTemperature ?? 0.7, responsePrompt: initialResponsePrompt ?? "" });
  const { messages, send, editMessage, deleteMessage, rewindToMessage, branchFromMessage, pinMessage, unpinMessage, isStreaming, error } = useChat(chatId, initialMessages);
  const setActiveChatId = useUiStore((state) => state.setActiveChatId);
  const setActiveCharacterId = useUiStore((state) => state.setActiveCharacterId);
  const sidePanelOpen = useUiStore((state) => state.sidePanelOpen);
  const setSidePanelOpen = useUiStore((state) => state.setSidePanelOpen);
  const toggleSidePanel = useUiStore((state) => state.toggleSidePanel);
  const activePersona = useUiStore((state) => state.activePersona);
  const providerModelGroups: ProviderModelGroup[] = useMemo(() => buildProviderModelGroups(providerKeys), [providerKeys]);
  const selectedProviderModel = inferProviderModelValue(model, providerModelGroups);

  useEffect(() => {
    setModel(initialModel || "gpt-4o-mini");
    setTemperature(initialTemperature ?? 0.7);
    setResponsePrompt(initialResponsePrompt ?? "");
    setApiSaveStatus(null);
    persistedApiRef.current = { model: initialModel || "gpt-4o-mini", temperature: initialTemperature ?? 0.7, responsePrompt: initialResponsePrompt ?? "" };
  }, [chatId, initialModel, initialResponsePrompt, initialTemperature]);

  useEffect(() => {
    setActiveChatId(chatId);
    setActiveCharacterId(characterId ?? null);
    return () => {
      setActiveChatId(null);
      setActiveCharacterId(null);
    };
  }, [characterId, chatId, setActiveCharacterId, setActiveChatId]);

  useEffect(() => {
    const nextModel = model.trim() || "gpt-4o-mini";
    const nextTemperature = Number.isFinite(temperature) ? temperature : 0.7;
    const nextResponsePrompt = responsePrompt.trim();
    const persisted = persistedApiRef.current;
    if (persisted.model === nextModel && persisted.temperature === nextTemperature && persisted.responsePrompt === nextResponsePrompt) {
      return;
    }

    setApiSaveStatus("Saving API settings...");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetch(`/api/chats/${chatId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: nextModel, temperature: nextTemperature, responsePrompt: nextResponsePrompt }),
        signal: controller.signal
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Could not save API settings.");
          }
          persistedApiRef.current = { model: nextModel, temperature: nextTemperature, responsePrompt: nextResponsePrompt };
          setApiSaveStatus("API settings saved.");
        })
        .catch((error) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            setApiSaveStatus("Could not save API settings.");
          }
        });
    }, 500);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [chatId, model, responsePrompt, temperature]);

  useEffect(() => {
    // Streaming state is still emitted for favicon compatibility without UI glow.
    window.dispatchEvent(new CustomEvent("nythera:brand-state", { detail: { glowIntensity: isStreaming ? 0.84 : 0.56 } }));
    return () => {
      window.dispatchEvent(new CustomEvent("nythera:brand-state", { detail: { glowIntensity: 0.56 } }));
    };
  }, [isStreaming]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    fetch("/api/keys", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((body: { keys?: SavedProviderSummary[] }) => {
        if (!cancelled) {
          setProviderKeys(Array.isArray(body.keys) ? body.keys : []);
        }
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setProviderKeys([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProviderKeysLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [chatId]);

  useEffect(() => {
    if (providerKeysLoading) {
      return;
    }

    if (providerModelGroups.length === 0) {
      return;
    }

    const inferredSelection = inferProviderModelValue(model, providerModelGroups);
    if (inferredSelection && inferredSelection !== model) {
      setModel(inferredSelection);
      return;
    }

    if (!inferredSelection) {
      const fallback = providerModelGroups.find((group) => group.isDefault)?.options[0] ?? providerModelGroups[0]?.options[0];
      if (fallback) {
        setModel(fallback.value);
      }
    }
  }, [model, providerKeysLoading, providerModelGroups]);

  function handleModelChange(value: string) {
    setModel(value);
  }

  function submitMessage() {
    const content = draft.trim();
    if (!content || isStreaming) {
      return;
    }

    setDraft("");
    void send(content, { model, temperature, responsePrompt });
  }

  function continueChat() {
    if (isStreaming) {
      return;
    }

    void send("", { model, temperature, responsePrompt, continueChat: true });
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
      responsePrompt,
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

  async function togglePin(messageId: string) {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;
    if (message.pinned) {
      await unpinMessage(messageId);
    } else {
      await pinMessage(messageId);
    }
  }

  return (
    <div className="relative isolate flex h-full min-h-0 flex-col overflow-hidden bg-[var(--bg-base)]">
      {characterAvatarUrl ? (
        <img
          src={characterAvatarUrl}
          alt=""
          className="chat-scene-art pointer-events-none absolute inset-0 -z-30 h-full w-full object-cover object-center opacity-60"
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          background:
            "linear-gradient(180deg, oklch(var(--color-canvas) / .48) 0%, oklch(var(--color-canvas) / .28) 34%, oklch(var(--color-canvas) / .82) 100%)"
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          background:
            "radial-gradient(ellipse 65% 45% at 50% 72%, var(--gradient-aurora-ambient)), radial-gradient(ellipse 45% 60% at 12% 44%, oklch(var(--color-canvas) / .94), transparent 70%)",
          opacity: 0.48
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-20 h-64"
        style={{
          background:
            "linear-gradient(to top, var(--bg-base) 0%, color-mix(in oklch, var(--bg-base) 78%, transparent) 58%, transparent 100%)"
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-56"
        style={{
          background:
            "linear-gradient(to bottom, var(--bg-base) 0%, color-mix(in oklch, var(--bg-base) 96%, transparent) 64%, transparent 100%)"
        }}
      />
      <div aria-hidden="true" className="glass-grain pointer-events-none absolute inset-0 -z-10" />
      <ChatHeader
        chatId={chatId}
        characterId={characterId}
        characterName={characterName}
        characterAvatarUrl={characterAvatarUrl}
        personaName={activePersona?.displayName}
        contextOpen={sidePanelOpen}
        onOpenContext={toggleSidePanel}
      />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <MessageList
            messages={messages}
            characterName={characterName}
            characterAvatarUrl={characterAvatarUrl}
            personaName={activePersona?.displayName}
            personaAvatarUrl={activePersona?.avatarUrl}
            summary={summary}
            error={error}
            onEdit={editMessage}
            onDelete={deleteMessage}
            onRegenerate={regenerate}
            onContinue={continueChat}
            onRewind={rewindToMessage}
            onBranch={branch}
            onPin={togglePin}
          />
          <ChatInput
            value={draft}
            onChange={setDraft}
            onSubmit={submitMessage}
            disabled={isStreaming}
            model={selectedProviderModel || model}
            modelGroups={providerModelGroups}
            modelLoading={providerKeysLoading}
            temperature={temperature}
            onModelChange={handleModelChange}
            onTemperatureChange={setTemperature}
            responsePrompt={responsePrompt}
            onResponsePromptChange={setResponsePrompt}
            apiStatus={apiSaveStatus}
            personaName={activePersona?.displayName}
            personaAvatarUrl={activePersona?.avatarUrl}
            onOpenComposer={() => setSidePanelOpen(true)}
          />
        </section>
      </div>
    </div>
  );
}
