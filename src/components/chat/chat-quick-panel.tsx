"use client";

import { useMemo, useState } from "react";
import { Brain, MessageSquare, PanelRightClose, Sparkles, UserRound } from "lucide-react";
import { HistoryTabContent, MemoryTabContent, PersonaTabContent } from "@/components/chat/chat-panel-tabs";
import { useChatQuickPanel } from "@/hooks/use-chat-quick-panel";
import { cn } from "@/lib/utils";

type ChatQuickPanelProps = {
  chatId: string;
  open: boolean;
  onClose: () => void;
  panel: ReturnType<typeof useChatQuickPanel>;
  onNewChat?: () => void;
};

const tabs = [
  { id: "persona", label: "Persona", icon: UserRound },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "history", label: "Chats", icon: MessageSquare }
] as const;

export function ChatQuickPanel({ chatId, open, onClose, panel, onNewChat }: ChatQuickPanelProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("persona");
  const panelTitle = useMemo(() => tabs.find((tab) => tab.id === activeTab)?.label ?? "Context", [activeTab]);

  if (!open) {
    return null;
  }

  return (
    <aside className="quick-panel glass-depth-panel relative fixed inset-x-2 bottom-2 top-16 z-40 flex flex-col overflow-hidden rounded-[26px] border border-white/[.1] bg-[color:oklch(var(--color-surface)/.66)] shadow-[var(--shadow-card),0_0_70px_oklch(var(--color-accent-primary)/.12)] backdrop-blur-[28px] sm:inset-x-3 sm:bottom-3 sm:top-20 sm:rounded-[30px] md:bottom-4 md:left-auto md:right-4 md:top-24 md:w-[390px] xl:static xl:h-full xl:w-[370px] xl:shrink-0">
      <div aria-hidden="true" className="glass-grain pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[color:oklch(var(--color-accent-primary)/.15)] blur-3xl" />
      <header className="relative flex h-16 shrink-0 items-center gap-3 border-b border-white/[.08] px-4">
        <div className="grid h-9 w-9 place-items-center rounded-[15px] bg-gradient-to-br from-[color:oklch(var(--color-accent-primary)/.24)] to-[color:oklch(var(--color-accent-secondary)/.12)] text-[var(--accent-secondary)]">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">Story context</p>
          <p className="truncate text-xs text-[var(--text-muted)]">{panelTitle} shapes this conversation</p>
        </div>
        <button type="button" aria-label="Hide quick panel" title="Hide quick panel" onClick={onClose} className="focus-ring grid h-9 w-9 place-items-center rounded-2xl text-[var(--text-secondary)] hover:bg-white/[0.055]">
          <PanelRightClose className="h-4 w-4" />
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <nav aria-label="Story context" className="flex w-[74px] shrink-0 flex-col gap-2 border-r border-white/[.08] p-2.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-label={tab.label} title={tab.label} className={cn("focus-ring flex h-14 flex-col items-center justify-center gap-1 rounded-[18px] text-[10px] font-medium transition-colors", active ? "border border-[rgb(var(--accent-rgb)_/.28)] bg-[var(--accent-purple-soft)] text-[var(--text-primary)] shadow-[var(--glass-highlight)]" : "text-[var(--text-muted)] hover:bg-white/[.05] hover:text-[var(--text-primary)]")}>
                <Icon className="h-[18px] w-[18px]" />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="chat-scroll min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
          {activeTab === "persona" ? <PersonaTabContent panel={panel} /> : null}
          {activeTab === "memory" ? <MemoryTabContent panel={panel} /> : null}
          {activeTab === "history" ? <HistoryTabContent panel={panel} chatId={chatId} onNewChat={onNewChat} /> : null}
        </div>
      </div>
    </aside>
  );
}
