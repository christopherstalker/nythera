"use client";

import Link from "next/link";
import {
  ChevronDown,
  Menu,
  MessageCircle,
  MoreHorizontal,
  PinOff,
  Search,
  Settings,
  Star,
  UserRound,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ModeSelector } from "@/components/chat/ModeSelector";
import { Avatar } from "@/components/ui/avatar";
import { GlassButton } from "@/components/ui/GlassButton";
import { normalizeChatMode, type ChatMode } from "@/lib/chat-mode";
import { cn } from "@/lib/utils";

type Presence = "online" | "away" | "offline";

type SidebarItem = {
  characterId: string;
  name: string;
  avatarUrl?: string | null;
  preview: string;
  chatId?: string | null;
  lastActiveAt?: string;
  unreadCount?: number;
  presence?: Presence;
};

type SidebarProps = {
  chatId: string;
  characterId?: string | null;
  chatMode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

function formatWhen(value?: string) {
  if (!value) return "";
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

function SidebarItemRow({
  item,
  active,
  pinned,
  onNavigate,
  onTogglePin
}: {
  item: SidebarItem;
  active: boolean;
  pinned: boolean;
  onNavigate: () => void;
  onTogglePin: () => void;
}) {
  const longPressTimer = useRef<number | null>(null);
  const href = item.chatId ? `/chat/${item.chatId}` : `/character/${item.characterId}`;

  function beginLongPress() {
    longPressTimer.current = window.setTimeout(onTogglePin, 550);
  }

  function cancelLongPress() {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  return (
    <div
      className="group relative"
      onContextMenu={(event) => {
        event.preventDefault();
        onTogglePin();
      }}
      onTouchStart={beginLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
    >
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(
          "chat-sidebar-item flex items-center gap-3 rounded-sm px-2 py-2 pr-8 no-underline transition-colors",
          active && "is-active"
        )}
      >
        <span className="relative shrink-0">
          <Avatar name={item.name} src={item.avatarUrl} size="sm" className="h-10 w-10 border-2 border-[var(--codex-rule)]" />
          <span className={cn("neo-glass-status-dot absolute bottom-0 right-0", `is-${item.presence ?? "offline"}`)} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-[var(--text-primary)]">{item.name}</span>
            <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{formatWhen(item.lastActiveAt)}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-[var(--text-secondary)]">{item.preview}</span>
        </span>
        {item.unreadCount ? (
          <span className="neo-glass-unread absolute right-2 top-1.5">{item.unreadCount > 99 ? "99+" : item.unreadCount}</span>
        ) : null}
      </Link>
      <button
        type="button"
        title={pinned ? "Unpin character" : "Pin character"}
        aria-label={pinned ? `Unpin ${item.name}` : `Pin ${item.name}`}
        onClick={onTogglePin}
        className="absolute bottom-2 right-1.5 grid h-7 w-7 place-items-center rounded-full text-[var(--text-muted)] opacity-0 transition hover:bg-[var(--color-overlay)] hover:text-[var(--text-primary)] focus:opacity-100 group-hover:opacity-100"
      >
        {pinned ? <PinOff className="h-3.5 w-3.5" /> : <MoreHorizontal className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function ChatSidebar(props: SidebarProps) {
  const {
    chatId,
    characterId,
    chatMode,
    onModeChange,
    mobileOpen,
    onMobileOpenChange,
    collapsed,
    onCollapsedChange
  } = props;
  const [query, setQuery] = useState("");
  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);
  const [favorites, setFavorites] = useState<SidebarItem[]>([]);
  const [recent, setRecent] = useState<SidebarItem[]>([]);
  const swipeStart = useRef<number | null>(null);

  const loadSidebar = useCallback(async () => {
    const response = await fetch("/api/chat-sidebar", { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json();
    setFavorites(Array.isArray(body.favorites) ? body.favorites : []);
    setRecent(Array.isArray(body.recent) ? body.recent : []);
  }, []);

  useEffect(() => {
    void loadSidebar();
  }, [chatId, loadSidebar]);

  useEffect(() => {
    function beginSwipe(event: TouchEvent) {
      const x = event.touches[0]?.clientX;
      if (typeof x === "number" && (mobileOpen || x <= 24)) swipeStart.current = x;
    }

    function finishSwipe(event: TouchEvent) {
      const start = swipeStart.current;
      const end = event.changedTouches[0]?.clientX;
      swipeStart.current = null;
      if (start === null || typeof end !== "number") return;
      if (!mobileOpen && end - start > 64) onMobileOpenChange(true);
      if (mobileOpen && start - end > 64) onMobileOpenChange(false);
    }

    window.addEventListener("touchstart", beginSwipe, { passive: true });
    window.addEventListener("touchend", finishSwipe, { passive: true });
    return () => {
      window.removeEventListener("touchstart", beginSwipe);
      window.removeEventListener("touchend", finishSwipe);
    };
  }, [mobileOpen, onMobileOpenChange]);

  const filteredFavorites = useMemo(() => filterItems(favorites, query), [favorites, query]);
  const filteredRecent = useMemo(() => {
    const pinnedIds = new Set(favorites.map((item) => item.characterId));
    return filterItems(recent.filter((item) => !pinnedIds.has(item.characterId)), query).slice(0, 5);
  }, [favorites, query, recent]);
  const noResults = Boolean(query.trim()) && filteredFavorites.length === 0 && filteredRecent.length === 0;

  async function togglePin(item: SidebarItem, pinned: boolean) {
    setFavorites((current) => pinned ? current.filter((favorite) => favorite.characterId !== item.characterId) : [item, ...current]);
    const response = await fetch("/api/chat-sidebar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ characterId: item.characterId, pinned: !pinned })
    });
    if (!response.ok) await loadSidebar();
  }

  const panel = (
    <aside className="chat-sidebar-panel flex h-full min-h-0 w-full flex-col">
      <div className={cn("flex items-center border-b border-white/[0.06] py-3", collapsed ? "justify-center px-2" : "justify-between px-4")}>
        <button
          type="button"
          className="neo-glass-icon-btn grid h-9 w-9 place-items-center"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => mobileOpen ? onMobileOpenChange(false) : onCollapsedChange(!collapsed)}
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
        {!collapsed ? <Link href="/" className="text-sm font-semibold tracking-wide text-[var(--text-primary)] no-underline">nythera</Link> : null}
        {!collapsed ? <span className="w-9" /> : null}
      </div>

      {collapsed ? (
        <div className="flex flex-1 flex-col items-center gap-3 py-4">
          <GlassButton variant="glass-icon" size="icon" title="Expand and search" aria-label="Expand and search" onClick={() => onCollapsedChange(false)}><Search className="h-4 w-4" /></GlassButton>
          <GlassButton asChild variant="glass-icon" size="icon" title="Settings"><Link href="/settings" aria-label="Settings"><Settings className="h-4 w-4" /></Link></GlassButton>
          <GlassButton asChild variant="glass-icon" size="icon" title="Profile"><Link href="/account" aria-label="Profile"><UserRound className="h-4 w-4" /></Link></GlassButton>
        </div>
      ) : (
        <>
          <div className="px-3 py-3">
            <label className="chat-sidebar-search flex items-center gap-2 px-3 py-2">
              <Search className="h-4 w-4 text-[var(--text-muted)]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search characters..." className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]" />
              {query ? <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="text-[var(--text-muted)]"><X className="h-3.5 w-3.5" /></button> : null}
            </label>
          </div>

          <div className="chat-sidebar-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-3">
            <SidebarSection icon={<Star className="h-3.5 w-3.5" />} title="Favorites" open={favoritesOpen} onToggle={() => setFavoritesOpen((value) => !value)}>
              {filteredFavorites.length ? filteredFavorites.map((item) => <SidebarItemRow key={item.characterId} item={item} active={item.characterId === characterId} pinned onNavigate={() => onMobileOpenChange(false)} onTogglePin={() => void togglePin(item, true)} />) : <EmptyLine icon={<Star className="h-4 w-4" />} text="No favorites yet" />}
            </SidebarSection>

            <SidebarSection icon={<MessageCircle className="h-3.5 w-3.5" />} title="Recent chats" open={recentOpen} onToggle={() => setRecentOpen((value) => !value)}>
              {filteredRecent.length ? filteredRecent.map((item) => <SidebarItemRow key={item.chatId ?? item.characterId} item={item} active={item.chatId === chatId} pinned={false} onNavigate={() => onMobileOpenChange(false)} onTogglePin={() => void togglePin(item, false)} />) : <EmptyLine icon={<MessageCircle className="h-4 w-4" />} text="No recent chats" />}
            </SidebarSection>

            {noResults ? <EmptyLine icon={<Search className="h-5 w-5" />} text="No characters found" centered /> : null}
          </div>

          <div className="space-y-3 border-t border-white/[0.06] px-3 py-3">
            <ModeSelector mode={normalizeChatMode(chatMode)} onChange={onModeChange} />
            <div className="flex items-center justify-between gap-2">
              <GlassButton asChild variant="glass-icon" size="icon" title="Settings"><Link href="/settings" aria-label="Settings"><Settings className="h-4 w-4" /></Link></GlassButton>
              <GlassButton asChild variant="glass-icon" size="icon" title="Profile"><Link href="/account" aria-label="Profile"><UserRound className="h-4 w-4" /></Link></GlassButton>
            </div>
          </div>
        </>
      )}
    </aside>
  );

  return (
    <>
      <div className={cn("hidden h-full min-h-0 lg:block", collapsed ? "w-[68px]" : "w-[260px] xl:w-[280px]")}>{panel}</div>
      <button type="button" className="neo-glass-icon-btn fixed left-3 top-[calc(12px+env(safe-area-inset-top))] z-40 grid h-10 w-10 place-items-center lg:hidden" aria-label="Open chat sidebar" onClick={() => onMobileOpenChange(true)}><Menu className="h-4 w-4" /></button>
      {mobileOpen ? (
        <>
        <button type="button" aria-label="Close sidebar backdrop" className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => onMobileOpenChange(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-screen sm:w-[260px] lg:hidden">{panel}</div>
        </>
      ) : null}
    </>
  );
}

function filterItems(items: SidebarItem[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => item.name.toLowerCase().includes(normalized) || item.preview.toLowerCase().includes(normalized));
}

function SidebarSection({ icon, title, open, onToggle, children }: { icon: ReactNode; title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section>
      <button type="button" className="mb-2 flex w-full items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]" onClick={onToggle}>
        <span className="flex items-center gap-1.5">{icon}{title}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} />
      </button>
      {open ? children : null}
    </section>
  );
}

function EmptyLine({ icon, text, centered = false }: { icon: ReactNode; text: string; centered?: boolean }) {
  return <p className={cn("flex items-center gap-2 px-3 py-3 text-xs text-[var(--text-muted)]", centered && "justify-center py-8")}>{icon}{text}</p>;
}
