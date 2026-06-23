"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  BookMarked,
  ChevronRight,
  Compass,
  Home,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  Settings,
  X
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { DesktopAppLink } from "@/components/pwa/desktop-app-link";
import { useUiStore } from "@/stores/use-ui-store";
import { cn } from "@/lib/utils";

type RecentChat = {
  id: string;
  title?: string | null;
  character: { id?: string | null; name: string; description?: string | null; avatarUrl?: string | null };
  messages: Array<{ content: string }>;
};

type ProfilePreview = { username?: string | null; avatarUrl?: string | null };
type UtilityView = "search" | "chats" | null;

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/library", label: "Library", icon: BookMarked },
  { href: "/create-character", label: "Create", icon: Plus },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const activeChatId = useUiStore((state) => state.activeChatId);
  const [query, setQuery] = useState("");
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [profilePreview, setProfilePreview] = useState<ProfilePreview | null>(null);
  const [utilityView, setUtilityView] = useState<UtilityView>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const isAuthenticated = status === "authenticated";
  const displayName = profilePreview?.username ?? session?.user?.username ?? session?.user?.name ?? session?.user?.email ?? "Nythera user";
  const avatarUrl = profilePreview?.avatarUrl ?? session?.user?.image ?? null;

  useEffect(() => {
    if (!isAuthenticated) {
      setRecentChats([]);
      return;
    }
    const controller = new AbortController();
    fetch("/api/chats", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => setRecentChats(Array.isArray(body?.chats) ? body.chats.slice(0, 10) : []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [isAuthenticated, pathname]);

  useEffect(() => {
    if (!isAuthenticated) {
      setProfilePreview(null);
      return;
    }
    let cancelled = false;
    fetch("/api/profile", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!cancelled && body?.profile) setProfilePreview(body.profile);
      })
      .catch(() => undefined);
    const onProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ profile?: ProfilePreview }>).detail;
      if (detail?.profile) setProfilePreview(detail.profile);
    };
    window.addEventListener("nythera:profile-updated", onProfileUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("nythera:profile-updated", onProfileUpdated);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    setUtilityView(null);
    setAccountOpen(false);
  }, [pathname]);

  const filteredChats = useMemo(() => {
    const unique = Array.from(new Map(recentChats.map((chat) => [chat.character.id ?? chat.id, chat])).values());
    const normalized = query.trim().toLowerCase();
    if (!normalized) return unique;
    return unique.filter((chat) => [chat.title, chat.character.name, chat.character.description].filter(Boolean).join(" ").toLowerCase().includes(normalized));
  }, [query, recentChats]);

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && query.trim()) router.push(`/explore?q=${encodeURIComponent(query.trim())}`);
  }

  function toggleUtility(view: Exclude<UtilityView, null>) {
    setAccountOpen(false);
    setUtilityView((current) => (current === view ? null : view));
  }

  return (
    <>
      <aside className={cn("nythera-rail group fixed bottom-4 left-4 top-4 z-40 hidden w-[72px] overflow-hidden rounded-[30px] border border-white/10 bg-[color:oklch(var(--color-surface)/.68)] shadow-[var(--shadow-card)] backdrop-blur-2xl transition-[width] duration-300 md:flex motion-reduce:transition-none", utilityView ? "rail-locked" : "hover:w-[236px] focus-within:w-[236px]")}>
        <div aria-hidden="true" className="glass-grain pointer-events-none absolute inset-0" />
        <div className="relative flex min-w-[234px] flex-1 flex-col p-2.5">
          <Link href="/" aria-label="Nythera home" className="focus-ring mb-4 flex h-12 items-center gap-3 rounded-[20px] px-2 no-underline">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[17px] border border-[rgb(var(--accent-rgb)_/.34)] bg-[var(--accent-purple-soft)] font-semibold text-[var(--text-primary)] shadow-[var(--shadow-glow)]">N</span>
            <span className="whitespace-nowrap text-sm font-semibold tracking-[.16em] text-[var(--text-primary)] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none">NYTHERA</span>
          </Link>

          <nav aria-label="Primary navigation" className="grid gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href} title={item.label} className={cn("rail-action", active && "rail-action-active")}>
                  <Icon className="h-[19px] w-[19px] shrink-0" />
                  <span className="rail-label">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="my-3 h-px bg-white/[.08]" />
          <button type="button" onClick={() => toggleUtility("search")} aria-expanded={utilityView === "search"} className={cn("rail-action", utilityView === "search" && "rail-action-active")}>
            <Search className="h-[19px] w-[19px] shrink-0" />
            <span className="rail-label">Search</span>
          </button>
          <button type="button" onClick={() => toggleUtility("chats")} aria-expanded={utilityView === "chats"} className={cn("rail-action", utilityView === "chats" && "rail-action-active")}>
            <MessageCircle className="h-[19px] w-[19px] shrink-0" />
            <span className="rail-label">Chats</span>
          </button>

          <div className="relative mt-auto">
            {accountOpen ? (
              <div className="absolute bottom-14 left-1 w-[212px] rounded-[22px] border border-white/10 bg-[color:oklch(var(--color-elevated)/.94)] p-1.5 shadow-[var(--shadow-card)] backdrop-blur-2xl">
                <DesktopAppLink collapsed={false} className="mb-1" />
                <Link href="/settings" className="nav-item"><Settings className="h-4 w-4" />Settings</Link>
                {isAuthenticated ? <button type="button" onClick={() => void signOut({ callbackUrl: "/" })} className="nav-item w-full"><LogOut className="h-4 w-4" />Logout</button> : null}
              </div>
            ) : null}
            {isAuthenticated ? (
              <button type="button" onClick={() => { setUtilityView(null); setAccountOpen((current) => !current); }} className="focus-ring flex h-12 w-full items-center gap-3 rounded-[20px] px-2 text-left hover:bg-white/[.05]">
                <Avatar name={displayName} src={avatarUrl} size="xs" />
                <span className="rail-label min-w-0 flex-1 truncate text-[var(--text-primary)]">{displayName}</span>
                <ChevronRight className="rail-label h-4 w-4" />
              </button>
            ) : (
              <Link href="/login" className="rail-action"><Avatar name="N" size="xs" /><span className="rail-label">Sign in</span></Link>
            )}
          </div>
        </div>
      </aside>

      {utilityView ? (
        <section className="fixed bottom-4 left-[100px] top-4 z-30 hidden w-[300px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[color:oklch(var(--color-surface)/.82)] shadow-[var(--shadow-card)] backdrop-blur-2xl md:flex">
          <div aria-hidden="true" className="glass-grain pointer-events-none absolute inset-0" />
          <header className="relative flex h-16 shrink-0 items-center border-b border-white/[.08] px-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">{utilityView === "search" ? "Search" : "Recent chats"}</h2>
            <button type="button" onClick={() => setUtilityView(null)} aria-label="Close utility panel" className="focus-ring ml-auto grid h-9 w-9 place-items-center rounded-full text-[var(--text-secondary)] hover:bg-white/[.06]"><X className="h-4 w-4" /></button>
          </header>
          <div className="relative flex min-h-0 flex-1 flex-col p-3">
            <label className="relative mb-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onSearchKeyDown} placeholder="Characters and chats" className="focus-ring glass-input h-11 w-full rounded-[16px] pl-9 pr-3 text-sm" />
            </label>
            <div className="chat-scroll grid min-h-0 gap-1 overflow-y-auto">
              {filteredChats.map((chat) => (
                <Link key={chat.id} href={`/chat/${chat.id}`} className={cn("flex items-center gap-3 rounded-[18px] p-2.5 no-underline transition-colors hover:bg-white/[.055]", (activeChatId === chat.id || pathname === `/chat/${chat.id}`) && "bg-[var(--accent-purple-soft)]")}>
                  <Avatar name={chat.character.name} src={chat.character.avatarUrl} size="xs" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[var(--text-primary)]">{chat.character.name}</span><span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{chat.title || chat.character.description || "Continue chat"}</span></span>
                </Link>
              ))}
              {filteredChats.length === 0 ? <p className="px-3 py-8 text-center text-sm leading-6 text-[var(--text-muted)]">No matching chats. Press Enter to explore characters.</p> : null}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
