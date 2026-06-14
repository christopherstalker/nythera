"use client";

import { create } from "zustand";

type UiState = {
  sidebarCollapsed: boolean;
  activeChatId: string | null;
  mobileNavOpen: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setActiveChatId: (chatId: string | null) => void;
  setMobileNavOpen: (open: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  activeChatId: null,
  mobileNavOpen: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setActiveChatId: (chatId) => set({ activeChatId: chatId }),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open })
}));
