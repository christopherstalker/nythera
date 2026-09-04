"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import Image from "next/image";
import { ChatInput } from "@/components/chat/ChatInput";
import { MusicEmbedPlayer } from "@/components/music/MusicEmbedPlayer";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList } from "@/components/chat/MessageList";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { shouldBypassNextImageOptimization } from "@/lib/image-cache";
import { buildProviderModelGroups, inferProviderModelValue, type ProviderModelCatalog, type ProviderModelGroup, type SavedProviderSummary } from "@/lib/provider-model-options";
import { CHAT_MODE_STORAGE_KEY, normalizeChatMode } from "@/lib/chat-mode";
import { normalizeChatAppearance, resolveBackgroundType } from "@/lib/chat-appearance";
import { useUiStore } from "@/stores/use-ui-store";
import { CHAT_CUSTOM_FONT_FAMILY, useCustomFontFace } from "@/hooks/use-custom-font";
import { latestAssistantVariantGroup } from "@/lib/message-actions";
import type { ChatImageAttachment } from "@/lib/chat-attachments";
import type { SkipTimeDuration } from "@/lib/chat-actions";
import { getScheduledMessageDelay, SCHEDULED_EVENTS_CHANGED_EVENT } from "@/lib/scheduled-messages";
import type { ChatInputLimits } from "@/lib/chat-limits";

type ChatClientProps = {
  chatId: string;
  chapterNumber: number;
  characterId?: string | null;
  characterName: string;
  characterAvatarUrl?: string | null;
  summary?: string | null;
  model?: string | null;
  temperature?: number | null;
  responsePrompt?: string | null;
  chatMode?: string | null;
  translationLanguage?: string | null;
  appearance?: unknown;
  characterBackgroundUrl?: string | null;
  characterLorebook?: unknown;
  initialMessages: ChatMessage[];
  initialActiveAssistantMessageId?: string | null;
  inputLimits?: ChatInputLimits;
};

const API_SETTINGS_SAVE_DEBOUNCE_MS = 500;
const ACTIVE_VARIANT_SAVE_DEBOUNCE_MS = 500;
const DOUBLE_TAP_MAX_DELAY_MS = 350;
const DOUBLE_TAP_MAX_DISTANCE_PX = 24;

export function ChatClient({ chatId, chapterNumber, characterId, characterName, characterAvatarUrl, characterBackgroundUrl, characterLorebook, summary, model: initialModel, temperature: initialTemperature, responsePrompt: initialResponsePrompt, chatMode: initialChatMode, translationLanguage: initialTranslationLanguage, appearance: initialAppearance, initialMessages, initialActiveAssistantMessageId, inputLimits }: ChatClientProps) {
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState(initialModel || "gpt-4o-mini");
  const [temperature, setTemperature] = useState(initialTemperature ?? 0.7);
  const [maxOutputTokens, setMaxOutputTokens] = useState<number | null>(null);
  const [responsePrompt, setResponsePrompt] = useState(initialResponsePrompt ?? "");
  const [translationLanguage, setTranslationLanguage] = useState(initialTranslationLanguage ?? "");
  const [apiSaveStatus, setApiSaveStatus] = useState<string | null>(null);
  const [readingMode, setReadingMode] = useState(false);
  const [activeAssistantMessageId, setActiveAssistantMessageId] = useState<string | null>(
    initialActiveAssistantMessageId ?? latestAssistantMessageId(initialMessages)
  );
  const [providerKeys, setProviderKeys] = useState<SavedProviderSummary[]>([]);
  const [providerModels, setProviderModels] = useState<ProviderModelCatalog>({});
  const [rejectedProviderIds, setRejectedProviderIds] = useState<string[]>([]);
  const [providerKeysLoading, setProviderKeysLoading] = useState(true);
  const [modelCatalogStatus, setModelCatalogStatus] = useState<string | null>(null);
  const persistedApiRef = useRef({ model: initialModel || "gpt-4o-mini", temperature: initialTemperature ?? 0.7, responsePrompt: initialResponsePrompt ?? "", translationLanguage: initialTranslationLanguage ?? "" });
  const { messages, summary: activeSummary, send, retryUserMessage, editMessage, deleteMessage, rewindToMessage, refreshMessages, branchFromMessage, pinMessage, unpinMessage, isStreaming, refreshing, error, providerNotice } = useChat(chatId, initialMessages, summary);
  const messagesRef = useRef(messages);
  const isStreamingRef = useRef(isStreaming);
  const chatSettingsRef = useRef({ model, temperature, responsePrompt });
  const activeAssistantMessageIdRef = useRef(activeAssistantMessageId);
  const persistedActiveAssistantMessageIdRef = useRef(initialActiveAssistantMessageId ?? latestAssistantMessageId(initialMessages));
  const activeVariantSaveTimeoutRef = useRef<number | null>(null);
  const activeVariantSaveAbortRef = useRef<AbortController | null>(null);
  const lastTouchRef = useRef({ time: 0, x: 0, y: 0 });
  const suppressDoubleClickUntilRef = useRef(0);
  const setActiveChatId = useUiStore((state) => state.setActiveChatId);
  const setActiveCharacterId = useUiStore((state) => state.setActiveCharacterId);
  const setActiveChatMode = useUiStore((state) => state.setActiveChatMode);
  const activeChatAppearance = useUiStore((state) => state.activeChatAppearance);
  const setActiveChatAppearance = useUiStore((state) => state.setActiveChatAppearance);
  const sidePanelOpen = useUiStore((state) => state.sidePanelOpen);
  const setSidePanelOpen = useUiStore((state) => state.setSidePanelOpen);
  const toggleSidePanel = useUiStore((state) => state.toggleSidePanel);
  const activePersona = useUiStore((state) => state.activePersona);
  const providerModelGroups: ProviderModelGroup[] = useMemo(
    () => buildProviderModelGroups(providerKeys.filter((key) => key.credentialStatus !== "INVALID" && !rejectedProviderIds.includes(key.provider)), providerModels),
    [providerKeys, providerModels, rejectedProviderIds]
  );
  const latestAssistantId = useMemo(() => latestAssistantMessageId(messages), [messages]);
  const selectedProviderModel = inferProviderModelValue(model, providerModelGroups);
  const usePlainSceneImage = Boolean(characterAvatarUrl && shouldBypassNextImageOptimization(characterAvatarUrl));
  useCustomFontFace(activeChatAppearance.fontUrl, CHAT_CUSTOM_FONT_FAMILY);

  useEffect(() => {
    const storedMode = window.localStorage.getItem(CHAT_MODE_STORAGE_KEY);
    setActiveChatMode(normalizeChatMode(initialChatMode ?? storedMode));
  }, [initialChatMode, setActiveChatMode]);

  useEffect(() => {
    setActiveChatAppearance(normalizeChatAppearance(initialAppearance));
  }, [chatId, initialAppearance, setActiveChatAppearance]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (activeAssistantMessageIdRef.current === latestAssistantId) {
      return;
    }

    activeAssistantMessageIdRef.current = latestAssistantId;
    setActiveAssistantMessageId(latestAssistantId);
    if (latestAssistantId && !latestAssistantId.startsWith("local-")) {
      persistedActiveAssistantMessageIdRef.current = latestAssistantId;
    }
  }, [latestAssistantId]);

  useEffect(() => () => {
    if (activeVariantSaveTimeoutRef.current) {
      window.clearTimeout(activeVariantSaveTimeoutRef.current);
    }
    activeVariantSaveAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    if (!readingMode) return;

    const exitReadingMode = (event: KeyboardEvent) => {
      if (event.key === "Escape") setReadingMode(false);
    };
    window.addEventListener("keydown", exitReadingMode);
    return () => window.removeEventListener("keydown", exitReadingMode);
  }, [readingMode]);

  useEffect(() => {
    let disposed = false;
    let requestInFlight = false;
    let checkTimeout: number | null = null;
    let requestController: AbortController | null = null;

    const clearScheduledCheck = () => {
      if (checkTimeout !== null) {
        window.clearTimeout(checkTimeout);
        checkTimeout = null;
      }
    };

    const scheduleCheck = (delay: number) => {
      clearScheduledCheck();
      checkTimeout = window.setTimeout(() => void checkScheduledMessages(), delay);
    };

    const checkScheduledMessages = async () => {
      checkTimeout = null;
      if (disposed || requestInFlight || document.visibilityState !== "visible" || isStreamingRef.current) {
        return;
      }

      requestInFlight = true;
      requestController = new AbortController();
      try {
        const response = await fetch(`/api/chats/${chatId}/scheduled`, {
          cache: "no-store",
          signal: requestController.signal
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || disposed) {
          return;
        }
        if (body?.created) {
          await refreshMessages();
        }
        const nextDelay = getScheduledMessageDelay(body?.nextTriggerAt);
        if (nextDelay !== null) {
          scheduleCheck(nextDelay);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Could not check scheduled messages.", error);
        }
      } finally {
        requestInFlight = false;
        requestController = null;
      }
    };

    const resumeScheduledChecks = () => {
      if (document.visibilityState === "visible" && !isStreamingRef.current) {
        scheduleCheck(0);
      } else {
        clearScheduledCheck();
      }
    };

    scheduleCheck(0);
    document.addEventListener("visibilitychange", resumeScheduledChecks);
    window.addEventListener("focus", resumeScheduledChecks);
    window.addEventListener(SCHEDULED_EVENTS_CHANGED_EVENT, resumeScheduledChecks);
    return () => {
      disposed = true;
      clearScheduledCheck();
      requestController?.abort();
      document.removeEventListener("visibilitychange", resumeScheduledChecks);
      window.removeEventListener("focus", resumeScheduledChecks);
      window.removeEventListener(SCHEDULED_EVENTS_CHANGED_EVENT, resumeScheduledChecks);
    };
  }, [chatId, isStreaming, refreshMessages]);

  useEffect(() => {
    const flushOfflineQueue = async () => {
      const queueKey = `nythera:offline-queue:${chatId}`;
      const queued = JSON.parse(window.localStorage.getItem(queueKey) || "[]") as Array<{ content: string; attachments: ChatImageAttachment[] }>;
      if (!queued.length || isStreamingRef.current) return;
      setApiSaveStatus(`Sending ${queued.length} queued message${queued.length === 1 ? "" : "s"}...`);
      const remaining = [...queued];
      while (remaining.length && navigator.onLine) {
        const item = remaining[0];
        const accepted = await send(item.content, { ...chatSettingsRef.current, attachments: item.attachments });
        if (!accepted) break;
        remaining.shift();
        window.localStorage.setItem(queueKey, JSON.stringify(remaining));
      }
      if (!remaining.length) {
        window.localStorage.removeItem(queueKey);
        setApiSaveStatus("Offline messages sent.");
      }
    };
    window.addEventListener("online", flushOfflineQueue);
    if (navigator.onLine) void flushOfflineQueue();
    return () => window.removeEventListener("online", flushOfflineQueue);
  }, [chatId, send]);

  useEffect(() => {
    chatSettingsRef.current = { model, temperature, responsePrompt };
  }, [model, responsePrompt, temperature]);

  useEffect(() => {
    setModel(initialModel || "gpt-4o-mini");
    setTemperature(initialTemperature ?? 0.7);
    setResponsePrompt(initialResponsePrompt ?? "");
    setApiSaveStatus(null);
    setTranslationLanguage(initialTranslationLanguage ?? "");
    persistedApiRef.current = { model: initialModel || "gpt-4o-mini", temperature: initialTemperature ?? 0.7, responsePrompt: initialResponsePrompt ?? "", translationLanguage: initialTranslationLanguage ?? "" };
  }, [chatId, initialModel, initialResponsePrompt, initialTemperature, initialTranslationLanguage]);

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
    const nextTranslationLanguage = translationLanguage.trim();
    const persisted = persistedApiRef.current;
    if (persisted.model === nextModel && persisted.temperature === nextTemperature && persisted.responsePrompt === nextResponsePrompt && persisted.translationLanguage === nextTranslationLanguage) {
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
          body: JSON.stringify({ model: nextModel, temperature: nextTemperature, responsePrompt: nextResponsePrompt, translationLanguage: nextTranslationLanguage || null }),
          signal: activeController.signal
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(typeof body?.error === "string" ? body.error : "Could not save API settings.");
        }

        persistedApiRef.current = { model: nextModel, temperature: nextTemperature, responsePrompt: nextResponsePrompt, translationLanguage: nextTranslationLanguage };
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
  }, [chatId, model, responsePrompt, temperature, translationLanguage]);

  useEffect(() => {
    // Streaming state is still emitted for favicon compatibility without UI glow.
    window.dispatchEvent(new CustomEvent("nythera:brand-state", { detail: { glowIntensity: isStreaming ? 0.84 : 0.56 } }));
    return () => {
      window.dispatchEvent(new CustomEvent("nythera:brand-state", { detail: { glowIntensity: 0.56 } }));
    };
  }, [isStreaming]);

  useEffect(() => {
    if (!readingMode) return;

    const exitReadingMode = (event: KeyboardEvent) => {
      if (event.key === "Escape") setReadingMode(false);
    };
    window.addEventListener("keydown", exitReadingMode);
    return () => window.removeEventListener("keydown", exitReadingMode);
  }, [readingMode]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadKeys() {
      try {
        const response = await fetch("/api/keys", { signal: controller.signal });
        if (!response.ok) {
          throw new Error("Could not load API keys.");
        }

        const body: { keys?: SavedProviderSummary[]; maxOutputTokens?: number | null } = await response.json();
        if (!cancelled) {
          setProviderKeys(Array.isArray(body.keys) ? body.keys : []);
          setMaxOutputTokens(typeof body.maxOutputTokens === "number" ? body.maxOutputTokens : null);
        }

        const catalogResponse = await fetch("/api/keys/models", { signal: controller.signal });
        if (!catalogResponse.ok) {
          throw new Error("Live model refresh is unavailable; bundled models remain available.");
        }
        const catalogBody: { providers?: Array<{ provider: string; models: string[]; warning?: string }> } = await catalogResponse.json();
        if (!cancelled) {
          const providers = Array.isArray(catalogBody.providers) ? catalogBody.providers : [];
          const providersById = new Map<string, typeof providers>();
          for (const provider of providers) {
            const entries = providersById.get(provider.provider) ?? [];
            entries.push(provider);
            providersById.set(provider.provider, entries);
          }
          setProviderModels(Object.fromEntries(Array.from(providersById, ([provider, entries]) => [
            provider,
            Array.from(new Set(entries.flatMap((entry) => entry.models)))
          ])));
          setRejectedProviderIds(Array.from(providersById)
            .filter(([, entries]) => entries.every((entry) => isRejectedCredential(entry.warning)))
            .map(([provider]) => provider));
          const warning = Array.from(providersById.values())
            .find((entries) => entries.every((entry) => Boolean(entry.warning)))?.[0]?.warning;
          setModelCatalogStatus(warning ?? "Provider models refreshed automatically.");

          const verifiedKeysResponse = await fetch("/api/keys", { signal: controller.signal });
          if (verifiedKeysResponse.ok && !cancelled) {
            const verifiedKeysBody: { keys?: SavedProviderSummary[]; maxOutputTokens?: number | null } = await verifiedKeysResponse.json();
            setProviderKeys(Array.isArray(verifiedKeysBody.keys) ? verifiedKeysBody.keys : []);
            setMaxOutputTokens(typeof verifiedKeysBody.maxOutputTokens === "number" ? verifiedKeysBody.maxOutputTokens : null);
          }
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

  const saveMaxOutputTokens = useCallback(async (value: number | null) => {
    setApiSaveStatus("Saving token limit...");
    try {
      const response = await fetch("/api/keys", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ maxOutputTokens: value })
      });
      const body: { maxOutputTokens?: number | null; error?: string } | null = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Could not save the token limit.");
      }

      const savedLimit = typeof body?.maxOutputTokens === "number" ? body.maxOutputTokens : null;
      setMaxOutputTokens(savedLimit);
      setApiSaveStatus(savedLimit === null ? "Automatic response limits restored." : `Maximum output saved at ${savedLimit} tokens.`);
      return true;
    } catch (error) {
      setApiSaveStatus(error instanceof Error ? error.message : "Could not save the token limit.");
      return false;
    }
  }, []);

  const submitMessage = useCallback(async (
    attachments: ChatImageAttachment[],
    contentOverride?: string
  ) => {
    const content = contentOverride?.trim() || draft.trim();
    if ((!content && !attachments.length) || isStreaming) {
      return false;
    }

    setDraft("");
    if (!navigator.onLine) {
      const queueKey = `nythera:offline-queue:${chatId}`;
      const queued = JSON.parse(window.localStorage.getItem(queueKey) || "[]") as Array<{ content: string; attachments: ChatImageAttachment[] }>;
      queued.push({ content, attachments });
      window.localStorage.setItem(queueKey, JSON.stringify(queued));
      setApiSaveStatus("Offline: message queued and will send automatically when you reconnect.");
      return true;
    }
    const branchMessageId = activeAssistantMessageIdRef.current;
    const accepted = await send(content, {
      model,
      temperature,
      responsePrompt,
      attachments,
      branchMessageId: branchMessageId?.startsWith("local-") ? undefined : branchMessageId ?? undefined
    });
    if (!accepted) {
      setDraft((current) => current || content);
    }
    return accepted;
  }, [chatId, draft, isStreaming, model, responsePrompt, send, temperature]);

  const selectActiveVariant = useCallback((messageId: string) => {
    if (activeAssistantMessageIdRef.current === messageId) return;
    activeAssistantMessageIdRef.current = messageId;
    setActiveAssistantMessageId(messageId);
    if (messageId.startsWith("local-") || persistedActiveAssistantMessageIdRef.current === messageId) return;

    if (activeVariantSaveTimeoutRef.current) {
      window.clearTimeout(activeVariantSaveTimeoutRef.current);
    }
    activeVariantSaveAbortRef.current?.abort();

    const controller = new AbortController();
    activeVariantSaveAbortRef.current = controller;
    activeVariantSaveTimeoutRef.current = window.setTimeout(() => {
      activeVariantSaveTimeoutRef.current = null;
      void fetch(`/api/chats/${chatId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ activeAssistantMessageId: messageId }),
        signal: controller.signal
      }).then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setApiSaveStatus(body?.error ?? "Could not save the selected response version.");
          return;
        }
        if (activeAssistantMessageIdRef.current === messageId) {
          persistedActiveAssistantMessageIdRef.current = messageId;
        }
      }).catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setApiSaveStatus("Could not save the selected response version.");
        }
      });
    }, ACTIVE_VARIANT_SAVE_DEBOUNCE_MS);
  }, [chatId]);

  const continueChat = useCallback((assistantMessageId: string) => {
    if (isStreamingRef.current) {
      return;
    }

    void send("", { ...chatSettingsRef.current, continueChat: true, continueMessageId: assistantMessageId });
  }, [send]);

  const skipTime = useCallback((assistantMessageId: string, duration: SkipTimeDuration) => {
    if (isStreamingRef.current) {
      return;
    }

    void send("", { ...chatSettingsRef.current, skipTime: true, skipTimeDuration: duration, continueMessageId: assistantMessageId });
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
      attachments: previousUser?.attachments,
      regenerate: true,
      regenerateMessageId: assistantMessageId
    });
  }, [send]);

  const retryMessage = useCallback((messageId: string) => {
    if (isStreamingRef.current) {
      return;
    }

    void retryUserMessage(messageId, chatSettingsRef.current);
  }, [retryUserMessage]);

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

  const toggleReadingMode = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setReadingMode((current) => !current);
  }, []);

  const handleDoubleClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (Date.now() < suppressDoubleClickUntilRef.current || isInteractiveTarget(event.target)) return;
    event.preventDefault();
    toggleReadingMode();
  }, [toggleReadingMode]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || isInteractiveTarget(event.target)) return;

    const now = Date.now();
    const previous = lastTouchRef.current;
    const closeInTime = now - previous.time <= DOUBLE_TAP_MAX_DELAY_MS;
    const closeInSpace = Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= DOUBLE_TAP_MAX_DISTANCE_PX;

    if (closeInTime && closeInSpace) {
      event.preventDefault();
      lastTouchRef.current = { time: 0, x: 0, y: 0 };
      suppressDoubleClickUntilRef.current = now + DOUBLE_TAP_MAX_DELAY_MS;
      toggleReadingMode();
      return;
    }

    lastTouchRef.current = { time: now, x: event.clientX, y: event.clientY };
  }, [toggleReadingMode]);

  return (
    <div
      className="chat-codex-workspace grid h-full min-h-0 touch-manipulation overflow-hidden bg-[var(--codex-paper)] lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)]"
      onDoubleClick={handleDoubleClick}
      onPointerUp={handlePointerUp}
      data-reading-mode={readingMode ? "true" : "false"}
    >
      <aside className="relative hidden min-h-0 overflow-hidden border-r border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] lg:flex lg:flex-col">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {characterAvatarUrl && usePlainSceneImage ? (
            <img src={characterAvatarUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
          ) : characterAvatarUrl ? (
            <Image src={characterAvatarUrl} alt="" fill priority sizes="300px" className="absolute inset-0 h-full w-full object-cover object-top" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--codex-paper-raised)] via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-7">
            <p className="mb-2 text-[10px] uppercase tracking-[.25em] text-[var(--codex-mint)]">Chapter {chapterNumber}</p>
            <h1 className="font-editorial text-6xl font-medium leading-[.75] text-[var(--codex-ivory)]">{characterName}</h1>
            <p className="mt-5 line-clamp-4 font-editorial text-lg leading-7 text-[var(--text-secondary)]">{activeSummary || "A living story shaped by memory, character, and every choice you make."}</p>
          </div>
        </div>
        <button type="button" onClick={toggleSidePanel} className="focus-ring flex h-16 items-center justify-between border-t border-[var(--codex-rule)] px-7 text-[10px] uppercase tracking-[.2em] text-[var(--text-secondary)] hover:text-[var(--codex-mint)]">
          Story dossier <span aria-hidden>{sidePanelOpen ? "−" : "+"}</span>
        </button>
      </aside>

      <section
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent"
        style={{
          "--chat-font-family": `'${(activeChatAppearance.fontUrl ? CHAT_CUSTOM_FONT_FAMILY : activeChatAppearance.fontFamily).replaceAll("'", "")}', serif`,
          "--chat-font-size": `${activeChatAppearance.fontSize}px`,
          "--chat-font-weight": activeChatAppearance.fontWeight,
          "--chat-line-height": activeChatAppearance.lineHeight,
          "--chat-content-width": `${activeChatAppearance.contentWidth}px`,
          "--chat-text-color": activeChatAppearance.textColor
        } as CSSProperties}
      >
        <ChatBackdrop appearance={activeChatAppearance} defaultUrl={characterBackgroundUrl || characterAvatarUrl} />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className={readingMode ? "hidden" : "contents"} aria-hidden={readingMode}>
            <ChatHeader
              chatId={chatId}
              chapterNumber={chapterNumber}
              characterId={characterId}
              characterName={characterName}
              characterAvatarUrl={characterAvatarUrl}
              personaName={activePersona?.displayName}
              contextOpen={sidePanelOpen}
              onOpenContext={toggleSidePanel}
              onRefresh={() => void refreshMessages()}
              refreshing={refreshing}
            />
          </div>
          {activeChatAppearance.music.enabled ? (
            <div className={readingMode
              ? "relative z-20 shrink-0 px-4 pt-4 sm:px-7 lg:px-10"
              : "relative z-20 shrink-0 px-4 pt-[calc(78px+env(safe-area-inset-top))] sm:px-7 sm:pt-[calc(86px+env(safe-area-inset-top))] lg:px-10"}>
              <MusicEmbedPlayer music={activeChatAppearance.music} compact className="mx-auto w-full max-w-[var(--chat-content-width,1000px)]" />
            </div>
          ) : null}
          <MessageList
            messages={messages}
            characterName={characterName}
            characterAvatarUrl={characterAvatarUrl}
            personaName={activePersona?.displayName}
            personaAvatarUrl={activePersona?.avatarUrl}
            summary={activeSummary}
            error={error}
            notice={providerNotice}
            onEdit={editMessage}
            onDelete={deleteMessage}
            onRegenerate={regenerate}
            onRetry={retryMessage}
            onContinue={continueChat}
            onSkipTime={skipTime}
            onRewind={rewindToMessage}
            onBranch={branch}
            onPin={togglePin}
            activeAssistantMessageId={activeAssistantMessageId}
            onActiveVariantChange={selectActiveVariant}
            hasSoundtrack={activeChatAppearance.music.enabled}
            readingMode={readingMode}
          />
          <div className={readingMode ? "hidden" : "contents"} aria-hidden={readingMode}>
            <ChatInput
              chatId={chatId}
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
              maxOutputTokens={maxOutputTokens}
              onMaxOutputTokensChange={saveMaxOutputTokens}
              responsePrompt={responsePrompt}
              onResponsePromptChange={setResponsePrompt}
              translationLanguage={translationLanguage}
              onTranslationLanguageChange={setTranslationLanguage}
              apiStatus={apiSaveStatus ?? modelCatalogStatus}
              personaName={activePersona?.displayName}
              personaAvatarUrl={activePersona?.avatarUrl}
              onOpenComposer={() => setSidePanelOpen(true)}
              lorebook={characterLorebook}
              recentMessages={messages}
              inputLimits={inputLimits}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function ChatBackdrop({ appearance, defaultUrl }: { appearance: ReturnType<typeof normalizeChatAppearance>; defaultUrl?: string | null }) {
  const mediaUrl = appearance.backgroundMode === "default"
    ? defaultUrl ?? ""
    : appearance.backgroundMode === "custom"
      ? appearance.backgroundUrl
      : "";
  const mediaType = resolveBackgroundType(mediaUrl, appearance.backgroundType);
  const mediaStyle = {
    objectFit: appearance.backgroundFit,
    objectPosition: appearance.backgroundPosition,
    filter: appearance.backgroundBlur ? `blur(${appearance.backgroundBlur}px)` : undefined,
    transform: appearance.backgroundBlur ? "scale(1.06)" : undefined
  } satisfies CSSProperties;

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[var(--codex-paper)]" aria-hidden>
      {mediaUrl && mediaType === "video" ? (
        <video src={mediaUrl} autoPlay loop muted playsInline preload="metadata" className="h-full w-full" style={mediaStyle} />
      ) : mediaUrl ? (
        <img src={mediaUrl} alt="" className="h-full w-full" style={mediaStyle} />
      ) : null}
      <div className="absolute inset-0 bg-black" style={{ opacity: mediaUrl ? appearance.backgroundDim : 0 }} />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/65 to-transparent" />
    </div>
  );
}

function isRejectedCredential(warning?: string | null) {
  return Boolean(warning?.toLowerCase().includes("rejected this api key"));
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(
    target.closest("a, button, input, textarea, select, option, [contenteditable='true'], [role='button']")
  );
}

function latestAssistantMessageId(messages: ChatMessage[]) {
  return latestAssistantVariantGroup(messages).at(-1)?.id ?? null;
}
