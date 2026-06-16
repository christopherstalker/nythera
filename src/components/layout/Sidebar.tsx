"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  BookMarked,
  Home,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  Settings
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { DesktopAppLink } from "@/components/pwa/desktop-app-link";
import { useUiStore } from "@/stores/use-ui-store";
import { cn } from "@/lib/utils";

type RecentChat = {
  id: string;
  title?: string | null;
  character: {
    name: string;
    description?: string | null;
    avatarUrl?: string | null;
  };
  messages: Array<{ content: string }>;
};

type ProfilePreview = {
  username?: string | null;
  avatarUrl?: string | null;
};

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
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const activeChatId = useUiStore((state) => state.activeChatId);
  const [query, setQuery] = useState("");
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [profilePreview, setProfilePreview] = useState<ProfilePreview | null>(null);
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
      .then((body) => setRecentChats(Array.isArray(body?.chats) ? body.chats.slice(0, 8) : []))
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
        if (!cancelled && body?.profile) {
          setProfilePreview({
            username: body.profile.username,
            avatarUrl: body.profile.avatarUrl
          });
        }
      })
      .catch(() => undefined);

    const onProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ profile?: ProfilePreview }>).detail;
      if (detail?.profile) {
        setProfilePreview(detail.profile);
      }
    };

    window.addEventListener("nythera:profile-updated", onProfileUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("nythera:profile-updated", onProfileUpdated);
    };
  }, [isAuthenticated]);

  const filteredChats = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return recentChats;
    }

    return recentChats.filter((chat) => {
      const haystack = [chat.title, chat.character.name, chat.character.description].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query, recentChats]);

  const labelClass = cn("min-w-0 truncate md:hidden lg:block", collapsed && "lg:hidden");

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/explore?q=${encodeURIComponent(trimmed)}`);
    }
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden border-r border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-soft)] backdrop-blur-2xl transition-[width] duration-200 md:flex md:w-[var(--sidebar-collapsed)] lg:w-[var(--sidebar-width)]",
        collapsed && "lg:w-[var(--sidebar-collapsed)]"
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col px-3 py-4">
        <div className="mb-5 flex h-11 items-center gap-3">
          <Link href="/" className={cn("focus-ring flex min-w-0 flex-1 items-center rounded-2xl px-2 no-underline", labelClass)}>
            <span className="font-semibold tracking-[0.18em] text-[var(--text-primary)]">NYTHERA</span>
          </Link>
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleSidebar}
            className="focus-ring hidden h-9 w-9 shrink-0 place-items-center rounded-2xl border border-[var(--border-default)] bg-white/[0.025] text-[var(--text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--text-primary)] lg:grid"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="mb-4" aria-label="Primary navigation">
          <div className="grid gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href} className={cn("nav-item", active && "nav-item-active")} title={item.label}>
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className={labelClass}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex min-h-0 flex-1 flex-col border-t border-[var(--border-subtle)] pt-4">
          <div className={cn("mb-3 md:hidden lg:block", collapsed && "lg:hidden")}>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search chats or characters"
                className="focus-ring glass-input h-10 w-full rounded-2xl pl-9 pr-3 text-sm focus:border-[var(--accent-purple)]"
              />
            </label>
          </div>
          <p className={cn("mb-2 px-3 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)] md:hidden lg:block", collapsed && "lg:hidden")}>
            Recent
          </p>
          <div className="grid min-h-0 flex-1 gap-1 overflow-y-auto chat-scroll">
            {filteredChats.slice(0, collapsed ? 6 : 8).map((chat) => {
              const active = activeChatId === chat.id || pathname === `/chat/${chat.id}`;
              return (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className={cn("nav-item h-12 px-2", active && "nav-item-active")}
                  title={chat.character.name}
                >
                  <Avatar name={chat.character.name} src={chat.character.avatarUrl} size="xs" />
                  <span className={cn("min-w-0 flex-1", labelClass)}>
                    <span className="block truncate text-sm">{chat.character.name}</span>
                    <span className="block truncate text-xs font-normal text-[var(--text-muted)]">{chat.character.description || "No description yet"}</span>
                  </span>
                </Link>
              );
            })}
            {filteredChats.length === 0 ? (
              <Link href="/explore" className="nav-item h-12 px-2">
                <MessageCircle className="h-5 w-5 shrink-0" />
                <span className={labelClass}>No recent chats</span>
              </Link>
            ) : null}
          </div>
        </div>

        <div className="relative mt-4 shrink-0 border-t border-[var(--border-subtle)] pt-3">
          <DesktopAppLink collapsed={collapsed} className="mb-2" />
          {isAuthenticated ? (
            <>
              <button
                type="button"
                onClick={() => setAccountOpen((current) => !current)}
                className="focus-ring flex h-12 w-full items-center gap-3 rounded-2xl px-2 text-left text-[var(--text-secondary)] transition-colors hover:bg-white/[0.05] hover:text-[var(--text-primary)]"
              >
                <Avatar name={displayName} src={avatarUrl} size="xs" />
                <span className={cn("min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-primary)]", labelClass)}>
                  {displayName}
                </span>
                <ChevronDown className={cn("h-4 w-4", labelClass)} />
              </button>
              {accountOpen ? (
                <div className={cn("absolute bottom-14 left-2 right-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1 shadow-[var(--shadow-card)] backdrop-blur-xl md:hidden lg:block", collapsed && "lg:hidden")}>
                  <Link href="/settings" className="nav-item" onClick={() => setAccountOpen(false)}>
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => void signOut({ callbackUrl: "/" })}
                    className="nav-item w-full"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <Link href="/login" className="nav-item">
              <Avatar name="N" size="xs" />
              <span className={labelClass}>Sign in</span>
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
