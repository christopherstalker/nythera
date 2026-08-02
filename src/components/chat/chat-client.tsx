"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList } from "@/components/chat/MessageList";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { shouldBypassNextImageOptimization } from "@/lib/image-cache";
import { buildProviderModelGroups, inferProviderModelValue, type ProviderModelCatalog, type ProviderModelGroup, type SavedProviderSummary } from "@/lib/provider-model-options";
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

const API_SETTINGS_SAVE_DEBOUNCE_MS = 500;

export function ChatClient({ chatId, characterId, characterName, characterAvatarUrl, summary, model: initialModel, temperature: initialTemperature, responsePrompt: initialResponsePrompt, initialMessages }: ChatClientProps) {
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState(initialModel || "gpt-4o-mini");
  const [temperature, setTemperature] = useState(initialTemperature ?? 0.7);
  const [responsePrompt, setResponsePrompt] = useState(initialResponsePrompt ?? "");
  const [apiSaveStatus, setApiSaveStatus] = useState<string | null>(null);
  const [providerKeys, setProviderKeys] = useState<SavedProviderSummary[]>([]);
  const [providerModels, setProviderModels] = useState<ProviderModelCatalog>({});
  const [providerKeysLoading, setProviderKeysLoading] = useState(true);
  const [modelCatalogStatus, setModelCatalogStatus] = useState<string | null>(null);
  const persistedApiRef = useRef({ model: initialModel || "gpt-4o-mini", temperature: initialTemperature ?? 0.7, responsePrompt: initialResponsePrompt ?? "" });
  const { messages, send, editMessage, deleteMessage, rewindToMessage, branchFromMessage, pinMessage, unpinMessage, isStreaming, error, providerNotice } = useChat(chatId, initialMessages);
  const messagesRef = useRef(messages);
  const isStreamingRef = useRef(isStreaming);
  const chatSettingsRef = useRef({ model, temperature, responsePrompt });
  const setActiveChatId = useUiStore((state) => state.setActiveChatId);
  const setActiveCharacterId = useUiStore((state) => state.setActiveCharacterId);
  const sidePanelOpen = useUiStore((state) => state.sidePanelOpen);
  const setSidePanelOpen = useUiStore((state) => state.setSidePanelOpen);
  const toggleSidePanel = useUiStore((state) => state.toggleSidePanel);
  const activePersona = useUiStore((state) => state.activePersona);
  const providerModelGroups: ProviderModelGroup[] = useMemo(() => buildProviderModelGroups(providerKeys, providerModels), [providerKeys, providerModels]);
  const selectedProviderModel = inferProviderModelValue(model, providerModelGroups);
  const usePlainSceneImage = Boolean(characterAvatarUrl && shouldBypassNextImageOptimization(characterAvatarUrl));

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    chatSettingsRef.current = { model, temperature, responsePrompt };
  }, [model, responsePrompt, temperature]);

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
      void saveApiSettings(controller);
    }, API_SETTINGS_SAVE_DEBOUNCE_MS);

    async function saveApiSettings(activeController: AbortController) {
      try {
        const response = await fetch(`/api/chats/${chatId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model: nextModel, temperature: nextTemperature, responsePrompt: nextResponsePrompt }),
          signal: activeController.signal
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(typeof body?.error === "string" ? body.error : "Could not save API settings.");
        }

        persistedApiRef.current = { model: nextModel, temperature: nextTemperature, responsePrompt: nextResponsePrompt };
        setApiSaveStatus("Saved for this chat and future chats.");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setApiSaveStatus(error instanceof Error ? error.message : "Could not save API settings.");
        }
      }
    }

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

    async function loadKeys() {
      try {
        const response = await fetch("/api/keys", { signal: controller.signal });
        if (!response.ok) {
          throw new Error("Could not load API keys.");
        }

        const body: { keys?: SavedProviderSummary[] } = await response.json();
        if (!cancelled) {
          setProviderKeys(Array.isArray(body.keys) ? body.keys : []);
          setProviderKeysLoading(false);
        }

        const catalogResponse = await fetch("/api/keys/models", { signal: controller.signal });
        if (!catalogResponse.ok) {
          throw new Error("Live model refresh is unavailable; bundled models remain available.");
        }
        const catalogBody: { providers?: Array<{ provider: string; models: string[]; warning?: string }> } = await catalogResponse.json();
        if (!cancelled) {
          const providers = Array.isArray(catalogBody.providers) ? catalogBody.providers : [];
          setProviderModels(Object.fromEntries(providers.map((provider) => [provider.provider, provider.models])));
          const warning = providers.find((provider) => provider.warning)?.warning;
          setModelCatalogStatus(warning ?? "Provider models refreshed automatically.");
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setModelCatalogStatus(error instanceof Error ? error.message : "Live model refresh is unavailable.");
        }
      } finally {
        if (!cancelled) {
          setProviderKeysLoading(false);
        }
      }
    }

    void loadKeys();

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

  const handleModelChange = useCallback((value: string) => {
    setModel(value);
  }, []);

  const submitMessage = useCallback(() => {
    const content = draft.trim();
    if (!content || isStreaming) {
      return;
    }

    setDraft("");
    void send(content, { model, temperature, responsePrompt });
  }, [draft, isStreaming, model, responsePrompt, send, temperature]);

  const continueChat = useCallback(() => {
    if (isStreamingRef.current) {
      return;
    }

    void send("", { ...chatSettingsRef.current, continueChat: true });
  }, [send]);

  const regenerate = useCallback((assistantMessageId: string) => {
    const currentMessages = messagesRef.current;
    const index = currentMessages.findIndex((message) => message.id === assistantMessageId);
    if (index < 0 || isStreamingRef.current) {
      return;
    }

    const previousUser = currentMessages
      .slice(0, index)
      .reverse()
      .find((message) => message.role === "USER");

    void send(previousUser?.content ?? "", {
      ...chatSettingsRef.current,
      regenerate: true,
      regenerateMessageId: assistantMessageId
    });
  }, [send]);

  const branch = useCallback(async (messageId: string) => {
    const branchId = await branchFromMessage(messageId);
    if (branchId) {
      window.location.href = `/chat/${branchId}`;
    }
  }, [branchFromMessage]);

  const togglePin = useCallback(async (messageId: string) => {
    const message = messagesRef.current.find((m) => m.id === messageId);
    if (!message) return;
    if (message.pinned) {
      await unpinMessage(messageId);
    } else {
      await pinMessage(messageId);
    }
  }, [pinMessage, unpinMessage]);

  return (
    <div className="chat-codex-workspace grid h-full min-h-0 overflow-hidden bg-[var(--codex-paper)] lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)]">
      <aside className="relative hidden min-h-0 overflow-hidden border-r border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] lg:flex lg:flex-col">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {characterAvatarUrl && usePlainSceneImage ? (
            <img src={characterAvatarUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
          ) : characterAvatarUrl ? (
            <Image src={characterAvatarUrl} alt="" fill priority sizes="300px" className="absolute inset-0 h-full w-full object-cover object-top" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--codex-paper-raised)] via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-7">
            <p className="mb-2 text-[10px] uppercase tracking-[.25em] text-[var(--codex-mint)]">Chapter 3</p>
            <h1 className="font-editorial text-6xl font-medium leading-[.75] text-[var(--codex-ivory)]">{characterName}</h1>
            <p className="mt-5 line-clamp-4 font-editorial text-lg leading-7 text-[var(--text-secondary)]">{summary || "A living story shaped by memory, character, and every choice you make."}</p>
          </div>
        </div>
        <button type="button" onClick={toggleSidePanel} className="focus-ring flex h-16 items-center justify-between border-t border-[var(--codex-rule)] px-7 text-[10px] uppercase tracking-[.2em] text-[var(--text-secondary)] hover:text-[var(--codex-mint)]">
          Story dossier <span aria-hidden>{sidePanelOpen ? "−" : "+"}</span>
        </button>
      </aside>

      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-52 overflow-hidden opacity-25 lg:hidden">
          {characterAvatarUrl && usePlainSceneImage ? (
            <img src={characterAvatarUrl} alt="" className="h-full w-full object-cover object-top" />
          ) : characterAvatarUrl ? (
            <Image src={characterAvatarUrl} alt="" fill priority sizes="100vw" className="h-full w-full object-cover object-top" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--codex-paper)]" />
        </div>
        <ChatHeader
          chatId={chatId}
          characterId={characterId}
          characterName={characterName}
          characterAvatarUrl={characterAvatarUrl}
          personaName={activePersona?.displayName}
          contextOpen={sidePanelOpen}
          onOpenContext={toggleSidePanel}
        />
        <div aria-hidden="true" className="glass-grain pointer-events-none absolute inset-0" />
          <MessageList
            messages={messages}
            characterName={characterName}
            characterAvatarUrl={characterAvatarUrl}
            personaName={activePersona?.displayName}
            personaAvatarUrl={activePersona?.avatarUrl}
            summary={summary}
            error={error}
            notice={providerNotice}
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
            apiStatus={apiSaveStatus ?? modelCatalogStatus}
            personaName={activePersona?.displayName}
            personaAvatarUrl={activePersona?.avatarUrl}
            onOpenComposer={() => setSidePanelOpen(true)}
          />
      </section>
    </div>
  );
}
