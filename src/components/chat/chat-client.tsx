"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatComposerSheet } from "@/components/chat/chat-composer-sheet";
import { MessageList } from "@/components/chat/MessageList";
import { ChatQuickPanel } from "@/components/chat/chat-quick-panel";
import { TopBar } from "@/components/layout/TopBar";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { useChatQuickPanel } from "@/hooks/use-chat-quick-panel";
import { buildProviderModelGroups, inferProviderModelValue, type ProviderModelGroup, type SavedProviderSummary } from "@/lib/provider-model-options";
import { useUiStore } from "@/stores/use-ui-store";
import { PanelRightOpen } from "lucide-react";

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
  const [quickPanelOpen, setQuickPanelOpen] = useState(false);
  const [composerSheetOpen, setComposerSheetOpen] = useState(false);
  const persistedApiRef = useRef({ model: initialModel || "gpt-4o-mini", temperature: initialTemperature ?? 0.7, responsePrompt: initialResponsePrompt ?? "" });
  const quickPanel = useChatQuickPanel({ chatId, characterId, enabled: true });
  const { messages, send, editMessage, deleteMessage, rewindToMessage, branchFromMessage, pinMessage, unpinMessage, isStreaming, error } = useChat(chatId, initialMessages);
  const setActiveChatId = useUiStore((state) => state.setActiveChatId);
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
    return () => setActiveChatId(null);
  }, [chatId, setActiveChatId]);

  useEffect(() => {
    setQuickPanelOpen(window.matchMedia("(min-width: 1280px)").matches);
  }, [chatId]);

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
    // Streaming state subtly raises brand glow without changing chat/proxy behavior.
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

  async function startNewChat() {
    if (!characterId) {
      return;
    }

    const response = await fetch("/api/chats", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ characterId, model, temperature })
    });

    if (!response.ok) {
      return;
    }

    const body = await response.json();
    if (body.chat?.id) {
      window.location.href = `/chat/${body.chat.id}`;
    }
  }

  return (
    <div className="relative isolate flex h-dvh min-h-dvh flex-col overflow-hidden bg-[var(--bg-base)]">
      {characterAvatarUrl ? (
        <img
          src={characterAvatarUrl}
          alt=""
          className="chat-scene-art pointer-events-none absolute inset-y-0 right-0 -z-20 h-full w-[72%] object-cover object-top opacity-40"
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--chat-overlay)" }} />
      <div aria-hidden="true" className="glass-grain pointer-events-none absolute inset-0 -z-10" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-52 bg-gradient-to-b from-primary/[0.11] to-transparent" />
      <div className="shrink-0 px-1.5 pt-1.5 sm:px-3 sm:pt-3">
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
      <div className="relative flex min-h-0 flex-1 flex-col gap-1.5 px-1.5 pb-0 sm:gap-3 md:flex-row md:px-3 md:pb-3">
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <MessageList
            messages={messages}
            characterName={characterName}
            characterAvatarUrl={characterAvatarUrl}
            personaName={quickPanel.activePersona?.displayName}
            personaAvatarUrl={quickPanel.activePersona?.avatarUrl}
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
            personaName={quickPanel.activePersona?.displayName}
            personaAvatarUrl={quickPanel.activePersona?.avatarUrl}
            onOpenComposer={() => setComposerSheetOpen(true)}
          />
        </section>
        {!quickPanelOpen ? (
          <button
            type="button"
            aria-label="Open quick panel"
            title="Open quick panel"
            onClick={() => setQuickPanelOpen(true)}
            className="focus-ring fixed right-3 top-24 z-30 hidden h-11 w-11 place-items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] shadow-[var(--shadow-card)] backdrop-blur-xl transition hover:border-[rgb(var(--accent-rgb)_/_0.45)] hover:text-[var(--text-primary)] md:grid xl:right-4"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
        ) : null}
        <ChatQuickPanel
          chatId={chatId}
          open={quickPanelOpen}
          onClose={() => setQuickPanelOpen(false)}
          panel={quickPanel}
          onNewChat={startNewChat}
        />
      </div>
      <ChatComposerSheet
        open={composerSheetOpen}
        onClose={() => setComposerSheetOpen(false)}
        chatId={chatId}
        panel={quickPanel}
        onNewChat={startNewChat}
      />
    </div>
  );
}
