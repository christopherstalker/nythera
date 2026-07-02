"use client";

import { create } from "zustand";

type UiState = {
  activeChatId: string | null;
  activeCharacterId: string | null;
  activePersona: { displayName: string; avatarUrl?: string | null } | null;
  mobileNavOpen: boolean;
  sidePanelOpen: boolean;
  setActiveChatId: (chatId: string | null) => void;
  setActiveCharacterId: (characterId: string | null) => void;
  setActivePersona: (persona: { displayName: string; avatarUrl?: string | null } | null) => void;
  setMobileNavOpen: (open: boolean) => void;
  setSidePanelOpen: (open: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  activeChatId: null,
  activeCharacterId: null,
  activePersona: null,
  mobileNavOpen: false,
  sidePanelOpen: false,
  setActiveChatId: (chatId) => set({ activeChatId: chatId }),
  setActiveCharacterId: (characterId) => set({ activeCharacterId: characterId }),
  setActivePersona: (persona) => set({ activePersona: persona }),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setSidePanelOpen: (open) => set({ sidePanelOpen: open })
}));
