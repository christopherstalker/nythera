"use client";

import { useEffect, useState } from "react";
import { Brain, ChevronLeft, History, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { HistoryTabContent, MemoryTabContent, PersonaTabContent } from "@/components/chat/chat-panel-tabs";
import type { useChatQuickPanel } from "@/hooks/use-chat-quick-panel";

export type ComposerSheetView = "menu" | "memory" | "history" | "persona";

type PanelState = ReturnType<typeof useChatQuickPanel>;

type ChatComposerSheetProps = {
  open: boolean;
  onClose: () => void;
  chatId: string;
  panel: PanelState;
  initialView?: ComposerSheetView;
  onNewChat?: () => void;
};

const titles: Record<ComposerSheetView, string> = {
  menu: "Chat tools",
  memory: "Memory",
  history: "History",
  persona: "Persona"
};

export function ChatComposerSheet({ open, onClose, chatId, panel, initialView = "menu", onNewChat }: ChatComposerSheetProps) {
  const [view, setView] = useState<ComposerSheetView>(initialView);

  useEffect(() => {
    if (open) {
      setView(initialView);
    }
  }, [open, initialView]);

  if (!open) {
    return null;
  }

  return (
    <>
      <button type="button" aria-label="Close chat tools" onClick={onClose} className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] md:hidden" />
      <section className="fixed inset-x-0 bottom-0 z-50 flex max-h-[min(88dvh,720px)] flex-col overflow-hidden rounded-t-[28px] border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] backdrop-blur-2xl md:hidden">
        <div className="flex shrink-0 flex-col items-center border-b border-[var(--border-subtle)] px-4 pb-3 pt-2">
          <div className="mb-3 h-1 w-10 rounded-full bg-white/15" />
          <div className="flex w-full items-center gap-2">
            {view !== "menu" ? (
              <button
                type="button"
                aria-label="Back"
                onClick={() => setView("menu")}
                className="focus-ring grid h-9 w-9 place-items-center rounded-2xl text-[var(--text-secondary)] hover:bg-white/[0.055]"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : (
              <span className="h-9 w-9" />
            )}
            <h2 className="min-w-0 flex-1 text-center text-base font-semibold text-[var(--text-primary)]">{titles[view]}</h2>
            <button type="button" aria-label="Close" onClick={onClose} className="focus-ring grid h-9 w-9 place-items-center rounded-2xl text-[var(--text-secondary)] hover:bg-white/[0.055]">
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
        </div>

        <div className="chat-scroll min-h-0 flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {view === "menu" ? (
            <div className="grid grid-cols-3 gap-3">
              <MenuTile label="Memory" icon={Brain} onClick={() => setView("memory")} />
              <MenuTile label="History" icon={History} onClick={() => setView("history")} />
              <MenuTile
                label="Persona"
                icon={UserRound}
                onClick={() => setView("persona")}
                avatarUrl={panel.activePersona?.avatarUrl}
                avatarName={panel.activePersona?.displayName}
              />
            </div>
          ) : null}
          {view === "memory" ? <MemoryTabContent panel={panel} /> : null}
          {view === "history" ? <HistoryTabContent panel={panel} chatId={chatId} onNavigate={onClose} onNewChat={onNewChat} /> : null}
          {view === "persona" ? <PersonaTabContent panel={panel} compact /> : null}
        </div>
      </section>
    </>
  );
}

function MenuTile({
  label,
  icon: Icon,
  onClick,
  avatarUrl,
  avatarName
}: {
  label: string;
  icon: typeof Brain;
  onClick: () => void;
  avatarUrl?: string | null;
  avatarName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring flex aspect-[0.92] flex-col overflow-hidden rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-input)] p-3 text-left shadow-[var(--glass-highlight)] transition hover:border-[rgb(var(--accent-rgb)_/_0.35)] hover:bg-white/[0.04]"
    >
      <span className="text-xs font-semibold text-[var(--text-primary)]">{label}</span>
      <span className="mt-auto grid flex-1 place-items-center">
        {avatarUrl || avatarName ? (
          <Avatar name={avatarName ?? label} src={avatarUrl} size="md" className="h-14 w-14 border border-white/10" />
        ) : (
          <span className="grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-[var(--bg-elevated)] text-[var(--accent-purple)]">
            <Icon className="h-6 w-6" />
          </span>
        )}
      </span>
    </button>
  );
}
