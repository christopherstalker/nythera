"use client";

import { create } from "zustand";
import type { ChatMode } from "@/lib/chat-mode";
import { DEFAULT_CHAT_APPEARANCE, type ChatAppearance } from "@/lib/chat-appearance";

type UiState = {
  activeChatId: string | null;
  activeCharacterId: string | null;
  activePersona: { displayName: string; avatarUrl?: string | null } | null;
  activeChatMode: ChatMode;
  activeChatAppearance: ChatAppearance;
  mobileNavOpen: boolean;
  sidePanelOpen: boolean;
  setActiveChatId: (chatId: string | null) => void;
  setActiveCharacterId: (characterId: string | null) => void;
  setActivePersona: (persona: { displayName: string; avatarUrl?: string | null } | null) => void;
  setActiveChatMode: (mode: ChatMode) => void;
  setActiveChatAppearance: (appearance: ChatAppearance) => void;
  setMobileNavOpen: (open: boolean) => void;
  setSidePanelOpen: (open: boolean) => void;
  toggleSidePanel: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  activeChatId: null,
  activeCharacterId: null,
  activePersona: null,
  activeChatMode: "realism",
  activeChatAppearance: DEFAULT_CHAT_APPEARANCE,
  mobileNavOpen: false,
  sidePanelOpen: false,
  setActiveChatId: (chatId) => set({ activeChatId: chatId }),
  setActiveCharacterId: (characterId) => set({ activeCharacterId: characterId }),
  setActivePersona: (persona) => set({ activePersona: persona }),
  setActiveChatMode: (activeChatMode) => set({ activeChatMode }),
  setActiveChatAppearance: (activeChatAppearance) => set({ activeChatAppearance }),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setSidePanelOpen: (open) => set({ sidePanelOpen: open }),
  toggleSidePanel: () => set((state) => ({ sidePanelOpen: !state.sidePanelOpen }))
}));
