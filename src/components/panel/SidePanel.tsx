"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, MessageSquare, PanelRightClose, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { HistoryTabContent, MemoryTabContent, PersonaTabContent } from "@/components/chat/chat-panel-tabs";
import { useChatQuickPanel } from "@/hooks/use-chat-quick-panel";
import { useUiStore } from "@/stores/use-ui-store";
import { cn } from "@/lib/utils";
import { springSoft, springSnappy } from "@/lib/motion";

const tabs = [
  { id: "persona", label: "Persona", icon: UserRound },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "history", label: "Chats", icon: MessageSquare }
] as const;

export function SidePanel() {
  const { status } = useSession();
  const pathname = usePathname();
  const isTablet = useTabletGlassFallback();
  const activeChatId = useUiStore((state) => state.activeChatId);
  const activeCharacterId = useUiStore((state) => state.activeCharacterId);
  const open = useUiStore((state) => state.sidePanelOpen);
  const setOpen = useUiStore((state) => state.setSidePanelOpen);
  const setActivePersona = useUiStore((state) => state.setActivePersona);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("persona");
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
          "side-panel orbital-functional fixed bottom-0 right-0 top-[var(--top-bar-height)] z-50 flex w-full max-w-[var(--side-panel-width)] translate-x-full flex-col overflow-hidden border-l border-[var(--border-subtle)] shadow-[var(--shadow-elevated)] md:top-0 xl:top-[var(--top-bar-height)] xl:h-[calc(100%-var(--top-bar-height))] xl:shrink-0",
          isChatSurface && "top-0 xl:top-0 xl:h-full",
          isTablet && "orbital-tablet-solid",
          open && "translate-x-0"
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={springSoft}
      >
        <div aria-hidden="true" className="glass-grain pointer-events-none absolute inset-0" />
        <header className="relative grid shrink-0 gap-2 border-b border-[var(--border-subtle)] px-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">Story context</p>
              <p className="truncate text-xs text-[var(--text-muted)]">{panelTitle}</p>
            </div>
            <motion.button
              type="button"
              aria-label="Hide side panel"
              onClick={() => setOpen(false)}
              whileTap={{ scale: 0.94 }}
              transition={springSnappy}
              className="focus-ring grid h-9 w-9 place-items-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--color-overlay)] hover:text-[var(--text-primary)]"
            >
              <PanelRightClose className="h-4 w-4" />
            </motion.button>
          </div>
          <nav
            aria-label="Story context"
            className="grid grid-cols-3 gap-1 rounded-[var(--radius-pill)] border border-[var(--border-subtle)] p-1"
            style={{ background: "color-mix(in oklch, var(--bg-elevated) 70%, transparent)" }}
          >
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
                    "focus-ring flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] px-2 text-xs font-semibold",
                    active ? "border border-[var(--codex-mint)]/45 bg-[color-mix(in_oklch,var(--codex-mint)_9%,transparent)] text-[var(--codex-mint)]" : "border border-transparent text-[var(--text-secondary)] hover:bg-[var(--color-overlay)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </motion.button>
              );
            })}
          </nav>
        </header>

        <div className="relative min-h-0 flex-1">
          <div className="chat-scroll h-full min-h-0 min-w-0 overflow-y-auto p-2">
            {activeTab === "persona" ? <PersonaTabContent panel={panel} /> : null}
            {activeTab === "memory" ? <MemoryTabContent panel={panel} /> : null}
            {activeTab === "history" ? <HistoryTabContent panel={panel} chatId={activeChatId ?? ""} onNavigate={() => setOpen(false)} /> : null}
          </div>
        </div>
      </motion.aside>
    </>
  );
}

function useTabletGlassFallback() {
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px) and (max-width: 1024px)");
    const update = () => setIsTablet(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isTablet;
}
