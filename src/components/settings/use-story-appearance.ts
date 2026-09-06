"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_CHAT_APPEARANCE, normalizeChatAppearance, type ChatAppearance } from "@/lib/chat-appearance";
import { useUiStore } from "@/stores/use-ui-store";

export function useStoryAppearance(chatId?: string) {
  const router = useRouter();
  const [draft, setDraft] = useState<ChatAppearance>(DEFAULT_CHAT_APPEARANCE);
  const [saved, setSaved] = useState<ChatAppearance | null>(null);
  const [story, setStory] = useState<{ title: string; character: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const dirty = saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    async function load() {
      try {
        const response = await fetch(`/api/settings/appearance${chatId ? `?${new URLSearchParams({ chatId })}` : ""}`, {
          cache: "no-store",
          signal: controller.signal
        });
        if (!response.ok) throw new Error("Could not load these settings. Try again.");
        const preferences = await response.json();
        if (controller.signal.aborted) return;
        const appearance = normalizeChatAppearance(preferences.appearance);
        setDraft(appearance);
        setSaved(appearance);
        setStory(preferences.story);
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : "Could not load settings.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [chatId, attempt]);

  useEffect(() => {
    if (!dirty && !saving) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    function beforeNavigation(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      if (saving || !window.confirm("Discard your unsaved appearance changes?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeNavigation, true);
    };
  }, [dirty, saving]);

  function update(changes: Partial<ChatAppearance>) {
    setDraft((current) => normalizeChatAppearance({ ...current, ...changes }));
    setStatus(null);
    setError(null);
  }

  async function save() {
    if (!saved || !dirty || saving) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/settings/appearance", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chatId, appearance: draft })
      });
      const preferences = await response.json();
      if (!response.ok)
        throw new Error(typeof preferences.error === "string" ? preferences.error : "Could not save your settings.");
      const appearance = normalizeChatAppearance(preferences.appearance);
      setSaved(appearance);
      setDraft(appearance);
      if (chatId === useUiStore.getState().activeChatId) useUiStore.getState().setActiveChatAppearance(appearance);
      setStatus(chatId ? "Saved for this conversation." : "Defaults saved. New chats will use this appearance.");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save. Your changes are still here.");
    } finally {
      setSaving(false);
    }
  }

  return {
    draft,
    update,
    dirty,
    saved,
    story,
    loading,
    saving,
    error,
    status,
    save,
    retry: () => setAttempt((value) => value + 1),
    undo: () => {
      if (saved) setDraft(saved);
      setError(null);
      setStatus(null);
    }
  };
}
