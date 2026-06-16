"use client";

import { useMemo, useState } from "react";
import { BookOpen, Brain, MessageSquare, UserRound, X } from "lucide-react";
import { HistoryTabContent, MemoryTabContent, PanelAvatarInput, PersonaTabContent } from "@/components/chat/chat-panel-tabs";
import { useChatQuickPanel } from "@/hooks/use-chat-quick-panel";
import { cn } from "@/lib/utils";

type ChatQuickPanelProps = {
  chatId: string;
  open: boolean;
  onClose: () => void;
  panel: ReturnType<typeof useChatQuickPanel>;
};

const tabs = [
  { id: "persona", label: "Persona", icon: UserRound },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "history", label: "Chats", icon: MessageSquare }
] as const;

export function ChatQuickPanel({ chatId, open, onClose, panel }: ChatQuickPanelProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("persona");
  const panelTitle = useMemo(() => tabs.find((tab) => tab.id === activeTab)?.label ?? "Quick panel", [activeTab]);

  if (!open) {
    return null;
  }

  return (
    <aside className="quick-panel fixed inset-x-3 bottom-3 top-20 z-40 flex flex-col overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] backdrop-blur-2xl md:bottom-4 md:left-auto md:right-4 md:top-24 md:w-[360px] xl:static xl:h-full xl:w-[340px] xl:shrink-0">
      <PanelAvatarInput panel={panel} />
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] px-3">
        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-[var(--accent-purple-soft)] text-[var(--accent-purple)]">
          <BookOpen className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{panelTitle}</p>
          <p className="truncate text-xs text-[var(--text-muted)]">Persona, memory, recent chats</p>
        </div>
        <button type="button" aria-label="Close quick panel" onClick={onClose} className="focus-ring grid h-9 w-9 place-items-center rounded-2xl text-[var(--text-secondary)] hover:bg-white/[0.055] xl:hidden">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="grid grid-cols-3 gap-1 border-b border-[var(--border-subtle)] p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "focus-ring flex h-10 items-center justify-center gap-1.5 rounded-2xl text-xs font-medium transition-colors",
                active ? "bg-[var(--accent-purple-soft)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-white/[0.055] hover:text-[var(--text-primary)]"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {activeTab === "persona" ? <PersonaTabContent panel={panel} /> : null}
        {activeTab === "memory" ? <MemoryTabContent panel={panel} /> : null}
        {activeTab === "history" ? <HistoryTabContent panel={panel} chatId={chatId} /> : null}
      </div>
    </aside>
  );
}
