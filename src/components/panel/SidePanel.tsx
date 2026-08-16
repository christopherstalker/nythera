"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BookKey, Brain, CheckCircle2, Map, MessageSquare, Paintbrush, PanelRightClose, Route, SlidersHorizontal, UserRound, UsersRound } from "lucide-react";
import { motion } from "motion/react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { CanonTabContent, CastTabContent, HistoryTabContent, MemoryTabContent, PersonaTabContent, PlotTabContent, SceneTabContent } from "@/components/chat/chat-panel-tabs";
import { useChatQuickPanel } from "@/hooks/use-chat-quick-panel";
import { CHAT_MODES, CHAT_MODE_STORAGE_KEY, type ChatMode } from "@/lib/chat-mode";
import { useUiStore } from "@/stores/use-ui-store";
import { cn } from "@/lib/utils";
import { springSoft, springSnappy } from "@/lib/motion";

const ChatAppearancePanel = dynamic(() => import("@/components/chat/ChatAppearancePanel").then((module) => module.ChatAppearancePanel));

const tabs = [
  { id: "persona", label: "Persona", icon: UserRound },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "cast", label: "Cast", icon: UsersRound },
  { id: "scene", label: "Scene", icon: Map },
  { id: "plot", label: "Plot", icon: Route },
  { id: "canon", label: "Canon", icon: BookKey },
  { id: "mode", label: "Mode", icon: SlidersHorizontal },
  { id: "appearance", label: "Appearance", icon: Paintbrush },
  { id: "history", label: "Chats", icon: MessageSquare }
] as const;

export function SidePanel() {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const activeChatId = useUiStore((state) => state.activeChatId);
  const activeCharacterId = useUiStore((state) => state.activeCharacterId);
  const open = useUiStore((state) => state.sidePanelOpen);
  const setOpen = useUiStore((state) => state.setSidePanelOpen);
  const setActivePersona = useUiStore((state) => state.setActivePersona);
  const activeChatMode = useUiStore((state) => state.activeChatMode);
  const setActiveChatMode = useUiStore((state) => state.setActiveChatMode);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("persona");
  const [modeStatus, setModeStatus] = useState<string | null>(null);
  const [chatCreateStatus, setChatCreateStatus] = useState<string | null>(null);
  const isChatSurface = pathname.startsWith("/chat/");
  const panel = useChatQuickPanel({
    chatId: activeChatId,
    characterId: activeCharacterId,
    enabled: status === "authenticated"
  });
  const panelTitle = useMemo(() => tabs.find((tab) => tab.id === activeTab)?.label ?? "Context", [activeTab]);

  useEffect(() => {
    setActivePersona(panel.activePersona ? { displayName: panel.activePersona.displayName, avatarUrl: panel.activePersona.avatarUrl } : null);
  }, [panel.activePersona, setActivePersona]);

  async function changeChatMode(mode: ChatMode) {
    if (!activeChatId || mode === activeChatMode) {
      return;
    }

    const previousMode = activeChatMode;
    setModeStatus("Saving mode...");
    setActiveChatMode(mode);
    window.localStorage.setItem(CHAT_MODE_STORAGE_KEY, mode);

    try {
      const response = await fetch(`/api/chats/${activeChatId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chatMode: mode })
      });
      if (!response.ok) {
        throw new Error("Could not update conversation mode.");
      }
      setModeStatus(`${CHAT_MODES.find((item) => item.id === mode)?.label ?? mode} will be used for the next reply.`);
    } catch (error) {
      setActiveChatMode(previousMode);
      window.localStorage.setItem(CHAT_MODE_STORAGE_KEY, previousMode);
      setModeStatus(error instanceof Error ? error.message : "Could not update conversation mode.");
    }
  }

  async function startNewChat() {
    if (!activeCharacterId) {
      return;
    }

    setChatCreateStatus("Starting a new conversation...");
    try {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ characterId: activeCharacterId })
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || typeof body?.chat?.id !== "string") {
        throw new Error(typeof body?.error === "string" ? body.error : "Could not start a new conversation.");
      }
      setOpen(false);
      router.push(`/chat/${body.chat.id}`);
    } catch (error) {
      setChatCreateStatus(error instanceof Error ? error.message : "Could not start a new conversation.");
    }
  }

  if (status !== "authenticated") {
    return null;
  }

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close side panel overlay"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/72"
        />
      ) : null}
      <motion.aside
        className={cn(
          "side-panel fixed bottom-0 right-0 top-[var(--top-bar-height)] z-50 grid w-full max-w-[420px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-l border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] shadow-[var(--shadow-elevated)] md:top-0 xl:top-[var(--top-bar-height)] xl:h-[calc(100dvh-var(--top-bar-height))] xl:shrink-0",
          isChatSurface && "top-0 h-dvh max-h-dvh xl:top-0 xl:h-dvh",
          open ? "translate-x-0" : "translate-x-full"
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={springSoft}
      >
        <header className="relative grid shrink-0 gap-3 border-b border-[var(--codex-rule)] px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-editorial text-xl text-[var(--codex-ivory)]">Story context</p>
              <p className="truncate text-[10px] uppercase tracking-[.18em] text-[var(--text-muted)]">{panelTitle}</p>
            </div>
            <motion.button
              type="button"
              aria-label="Hide side panel"
              onClick={() => setOpen(false)}
              whileTap={{ scale: 0.94 }}
              transition={springSnappy}
              className="focus-ring grid h-9 w-9 place-items-center rounded-sm border border-[var(--codex-rule)] text-[var(--text-secondary)] hover:border-[var(--codex-mint)] hover:text-[var(--text-primary)]"
            >
              <PanelRightClose className="h-4 w-4" />
            </motion.button>
          </div>
          <div className="grid grid-cols-2 gap-2 border-y border-[var(--codex-rule)] py-3 text-xs">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[.14em] text-[var(--text-muted)]">Active persona</p>
              <p className="mt-1 truncate text-[var(--text-primary)]">{panel.activePersona?.displayName ?? "Default persona"}</p>
            </div>
            <div className="min-w-0 border-l border-[var(--codex-rule)] pl-3">
              <p className="text-[10px] uppercase tracking-[.14em] text-[var(--text-muted)]">Context status</p>
              <p className="mt-1 flex items-center gap-1.5 truncate text-[var(--codex-mint)]">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {panel.pendingAction ? "Saving..." : panel.lastSavedAt ? "Applied to next reply" : `${panel.memories.length} memories ready`}
              </p>
            </div>
          </div>
          <nav aria-label="Story context" className="chat-scroll flex gap-1 overflow-x-auto pb-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-label={tab.label}
                  whileTap={{ scale: 0.96 }}
                  transition={springSnappy}
                  className={cn(
                    "focus-ring flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-sm border px-2.5 text-[11px] font-semibold",
                    active ? "border-[var(--codex-mint)] text-[var(--codex-mint)]" : "border-[var(--codex-rule)] text-[var(--text-secondary)] hover:border-[var(--codex-violet)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </motion.button>
              );
            })}
          </nav>
        </header>

        <div
          data-testid="story-context-scroll"
          className="chat-scroll side-panel-scroll min-h-0 min-w-0 touch-pan-y overflow-y-auto overscroll-y-contain p-4 [scrollbar-gutter:stable]"
        >
          {panel.panelLoadStatus ? <p role="alert" className="mb-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-xs leading-5 text-red-200">{panel.panelLoadStatus}</p> : null}
          {activeTab === "persona" ? <PersonaTabContent panel={panel} /> : null}
          {activeTab === "memory" ? <MemoryTabContent panel={panel} /> : null}
          {activeTab === "cast" ? <CastTabContent panel={panel} /> : null}
          {activeTab === "scene" ? <SceneTabContent panel={panel} /> : null}
          {activeTab === "plot" ? <PlotTabContent panel={panel} /> : null}
          {activeTab === "canon" ? <CanonTabContent panel={panel} /> : null}
          {activeTab === "mode" ? <ModeTabContent activeMode={activeChatMode} status={modeStatus} onChange={(mode) => void changeChatMode(mode)} /> : null}
          {activeTab === "appearance" ? <ChatAppearancePanel /> : null}
          {activeTab === "history" ? (
            <>
              <HistoryTabContent panel={panel} chatId={activeChatId ?? ""} characterId={activeCharacterId} onNavigate={() => setOpen(false)} onNewChat={() => void startNewChat()} />
              {chatCreateStatus ? <p role="status" className="mt-3 border-l-2 border-[var(--codex-mint)] pl-3 text-xs text-[var(--text-secondary)]">{chatCreateStatus}</p> : null}
            </>
          ) : null}
        </div>
      </motion.aside>
    </>
  );
}

function ModeTabContent({ activeMode, status, onChange }: { activeMode: ChatMode; status: string | null; onChange: (mode: ChatMode) => void }) {
  return (
    <div className="grid gap-5">
      <div>
        <p className="codex-kicker">Conversation mode</p>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Choose how the character responds. The change is stored for this chat and applies from the next message.</p>
      </div>
      <div className="grid gap-2">
        {CHAT_MODES.map((mode) => {
          const active = mode.id === activeMode;
          return (
            <button
              key={mode.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(mode.id)}
              className={cn(
                "focus-ring grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-sm border p-4 text-left transition-colors",
                active ? "border-[var(--codex-mint)] bg-[var(--color-overlay)]" : "border-[var(--codex-rule)] hover:border-[var(--codex-violet)]"
              )}
            >
              <span className="text-lg" aria-hidden>{mode.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--text-primary)]">{mode.label}</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{mode.description}</span>
              </span>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: mode.color }} />
            </button>
          );
        })}
      </div>
      {status ? <p role="status" className="border-l-2 border-[var(--codex-mint)] pl-3 text-xs leading-5 text-[var(--text-secondary)]">{status}</p> : null}
      <Link href="/settings/providers" className="focus-ring flex h-11 items-center justify-center rounded-sm border border-[var(--codex-rule)] text-xs font-semibold uppercase tracking-[.12em] text-[var(--text-secondary)] no-underline hover:border-[var(--codex-violet)] hover:text-[var(--text-primary)]">
        Provider settings
      </Link>
    </div>
  );
}
