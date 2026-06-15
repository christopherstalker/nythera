"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowRight,
  BookOpen,
  Compass,
  Filter,
  Heart,
  History,
  Home,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Settings,
  Smile,
  Sparkles,
  Star,
  UserRound
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CharacterSummary } from "@/components/characters/CharacterCard";

type RecentChat = {
  id: string;
  title?: string | null;
  character: {
    id?: string | null;
    name: string;
    description?: string | null;
    avatarUrl?: string | null;
  };
  messages: Array<{ content: string; role?: string }>;
};

type HomeCharacter = {
  id: string;
  source: "real" | "showcase";
  name: string;
  subtitle: string;
  description: string;
  image: string;
  avatar: string;
  category: string;
};

const tabs = ["For You", "Trending", "New", "Fantasy", "Sci-Fi", "Romance"];

const showcaseCharacters: HomeCharacter[] = [
  {
    id: "showcase-raven",
    source: "showcase",
    name: "Raven",
    subtitle: "Childhood friend",
    description: "Guarded. Loyal. Hides more than he says.",
    image: "/nythera-showcase/raven-card.png",
    avatar: "/nythera-showcase/raven-avatar.png",
    category: "For You"
  },
  {
    id: "showcase-elara",
    source: "showcase",
    name: "Elara Voss",
    subtitle: "Moonlight oracle",
    description: "Sees what others cannot. Speaks in riddles.",
    image: "/nythera-showcase/elara-card.png",
    avatar: "/nythera-showcase/elara-avatar.png",
    category: "Fantasy"
  },
  {
    id: "showcase-kael",
    source: "showcase",
    name: "Kael Draven",
    subtitle: "Fallen knight",
    description: "Bound by oath. Torn by something deeper.",
    image: "/nythera-showcase/kael-card.png",
    avatar: "/nythera-showcase/kael-avatar.png",
    category: "Trending"
  },
  {
    id: "showcase-zero",
    source: "showcase",
    name: "Zero",
    subtitle: "Digital apparition",
    description: "A mind without a body. Curious. Unpredictable.",
    image: "/nythera-showcase/zero-card.png",
    avatar: "/nythera-showcase/zero-avatar.png",
    category: "Sci-Fi"
  }
];

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/create-character", label: "Create", icon: Plus },
  { href: "/settings", label: "Settings", icon: Settings }
];

// The home route uses a standalone pixel shell so the landing experience can match the Nythera reference without inheriting AppShell chrome.
export default function HomePage() {
  const router = useRouter();
  const { status } = useSession();
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("For You");
  const [activeId, setActiveId] = useState(showcaseCharacters[0].id);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHome() {
      const [charactersResponse, chatsResponse] = await Promise.allSettled([
        fetch("/api/characters?take=24", { signal: controller.signal }),
        status === "authenticated" ? fetch("/api/chats", { cache: "no-store", signal: controller.signal }) : Promise.resolve(null)
      ]);

      if (charactersResponse.status === "fulfilled" && charactersResponse.value.ok) {
        const body = await charactersResponse.value.json().catch(() => null);
        setCharacters(Array.isArray(body?.characters) ? body.characters : []);
      }

      if (chatsResponse.status === "fulfilled" && chatsResponse.value?.ok) {
        const body = await chatsResponse.value.json().catch(() => null);
        setRecentChats(Array.isArray(body?.chats) ? body.chats.slice(0, 4) : []);
      }
    }

    void loadHome().catch(() => undefined);
    return () => controller.abort();
  }, [status]);

  const realCharacters = useMemo(() => characters.map(toHomeCharacter).filter(Boolean) as HomeCharacter[], [characters]);
  const allCharacters = realCharacters.length > 0 ? realCharacters : showcaseCharacters;
  const visibleCharacters = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = allCharacters.filter((character) => {
      const matchesTab = activeTab === "For You" || character.category === activeTab || character.subtitle.toLowerCase().includes(activeTab.toLowerCase());
      const matchesQuery = !normalized || [character.name, character.subtitle, character.description].join(" ").toLowerCase().includes(normalized);
      return matchesTab && matchesQuery;
    });
    return filtered.length > 0 ? filtered : allCharacters;
  }, [activeTab, allCharacters, query]);
  const activeCharacter = visibleCharacters.find((character) => character.id === activeId) ?? visibleCharacters[0] ?? showcaseCharacters[0];
  const sidebarChats = recentChats.length > 0 ? recentChats.map(chatToSidebarItem) : showcaseSidebarChats;

  async function startChat(character: HomeCharacter) {
    if (character.source !== "real") {
      router.push(status === "authenticated" ? "/create-character" : "/login");
      return;
    }

    const response = await fetch("/api/chats", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ characterId: character.id })
    });

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      router.push(`/character/${character.id}`);
      return;
    }

    const body = await response.json();
    router.push(`/chat/${body.chat.id}`);
  }

  return (
    <main className="min-h-dvh overflow-hidden bg-[#03060b] p-3 text-[#f4f2f0] sm:p-5 lg:p-6">
      <div
        className={cn(
          "mx-auto grid min-h-[calc(100dvh-1.5rem)] w-full max-w-[1626px] overflow-hidden rounded-[26px] border border-white/[0.18]",
          "bg-[#070a10] shadow-[0_28px_90px_rgba(0,0,0,0.58)] lg:h-[calc(100dvh-3rem)] lg:min-h-[760px] lg:grid-cols-[240px_480px_minmax(0,1fr)]"
        )}
      >
        <PixelSidebar chats={sidebarChats} />
        <DiscoveryPanel
          query={query}
          onQueryChange={setQuery}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          characters={visibleCharacters}
          activeId={activeCharacter.id}
          onSelect={setActiveId}
          onStart={startChat}
        />
        <ChatPreview character={activeCharacter} />
        <MobileChatPreview character={activeCharacter} />
      </div>
    </main>
  );
}

function PixelSidebar({ chats }: { chats: Array<{ name: string; avatar: string; active?: boolean }> }) {
  return (
    <aside className="hidden min-h-0 border-r border-white/[0.16] bg-[linear-gradient(180deg,rgba(10,13,20,0.98),rgba(7,10,16,0.94))] px-5 py-6 lg:flex lg:flex-col">
      <Link href="/" className="flex items-center gap-3 no-underline">
        <img src="/nythera-showcase/nythera-logo-mark.png" alt="" className="h-10 w-9 object-contain drop-shadow-[0_0_18px_rgba(255,122,24,0.65)]" />
        <span className="text-[26px] font-semibold tracking-[-0.02em] text-white">Nythera</span>
      </Link>

      <nav className="mt-8 grid gap-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex h-14 items-center gap-4 rounded-xl px-4 text-[15px] text-white/72 no-underline transition hover:bg-white/[0.06] hover:text-white",
                active && "bg-white/[0.075] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              )}
            >
              {active ? <span className="absolute inset-y-0 -left-1 w-1.5 rounded-full bg-[#ff7a18] shadow-[0_0_18px_rgba(255,122,24,0.75)]" /> : null}
              <Icon className={cn("h-5 w-5", active ? "text-[#ff7a18]" : "text-white/72")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-white/[0.1] bg-white/[0.025] p-3">
        <p className="mb-4 px-1 text-xs text-white/42">Recent chats</p>
        <div className="grid gap-3">
          {chats.map((chat) => (
            <div key={chat.name} className="flex items-center gap-3">
              <img src={chat.avatar} alt="" className="h-10 w-10 rounded-full border border-white/15 object-cover" />
              <span className="min-w-0 flex-1 truncate text-sm text-white/76">{chat.name}</span>
              {chat.active ? <span className="h-1.5 w-1.5 rounded-full bg-[#ff7a18] shadow-[0_0_12px_rgba(255,122,24,0.9)]" /> : null}
            </div>
          ))}
        </div>
      </div>

      <Link href="/settings" className="mt-5 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 no-underline">
        <img src="/nythera-showcase/amara-avatar.png" alt="" className="h-12 w-12 rounded-full border border-[#ffb347]/50 object-cover" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">Amara</span>
          <span className="block truncate text-xs text-white/48">View profile</span>
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-[#ff7a18] shadow-[0_0_12px_rgba(255,122,24,0.9)]" />
      </Link>
    </aside>
  );
}

function DiscoveryPanel({
  query,
  onQueryChange,
  activeTab,
  onTabChange,
  characters,
  activeId,
  onSelect,
  onStart
}: {
  query: string;
  onQueryChange: (value: string) => void;
  activeTab: string;
  onTabChange: (value: string) => void;
  characters: HomeCharacter[];
  activeId: string;
  onSelect: (id: string) => void;
  onStart: (character: HomeCharacter) => void;
}) {
  return (
    <section className="min-h-0 bg-[linear-gradient(180deg,rgba(9,12,18,0.98),rgba(8,10,17,0.96))] p-4 sm:p-5 lg:overflow-hidden lg:border-r lg:border-white/[0.16]">
      <MobileBrandHeader />
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/58" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search characters..."
          className="h-12 w-full rounded-xl border border-white/[0.14] bg-black/20 pl-12 pr-16 text-sm text-white outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] placeholder:text-white/36 focus:border-[#ff7a18]/60"
        />
        <span className="absolute right-14 top-2.5 h-7 w-px bg-white/[0.12]" />
        <Filter className="absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-white/62" />
      </div>

      <div className="mt-5 flex items-center gap-1 overflow-x-auto rounded-2xl border border-white/[0.12] bg-black/18 p-1 scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={cn(
              "h-8 shrink-0 rounded-full px-3 text-[11px] transition",
              activeTab === tab
                ? "border border-[#ff7a18]/45 bg-[#ff7a18]/20 text-[#ffb347] shadow-[0_0_20px_rgba(255,122,24,0.18)]"
                : "text-white/45 hover:text-white/72"
            )}
          >
            {tab}
          </button>
        ))}
        <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-white/68" />
      </div>

      <div className="mt-3 grid gap-4 pb-24 sm:grid-cols-2 lg:max-h-[calc(100dvh-12.8rem)] lg:overflow-y-auto lg:pb-2 lg:pr-1">
        {characters.map((character) => (
          <CharacterTile
            key={character.id}
            character={character}
            active={character.id === activeId}
            onSelect={() => onSelect(character.id)}
            onStart={() => onStart(character)}
          />
        ))}
      </div>
    </section>
  );
}

function MobileBrandHeader() {
  return (
    <div className="mb-5 flex items-center justify-between lg:hidden">
      <Link href="/" className="flex items-center gap-3 no-underline">
        <img src="/nythera-showcase/nythera-logo-mark.png" alt="" className="h-10 w-9 object-contain drop-shadow-[0_0_18px_rgba(255,122,24,0.65)]" />
        <span className="text-2xl font-semibold tracking-[-0.02em] text-white">Nythera</span>
      </Link>
      <Link
        href="/create-character"
        className="grid h-11 w-11 place-items-center rounded-full border border-[#ff7a18]/35 bg-[#ff7a18]/14 text-[#ffb347] shadow-[0_0_20px_rgba(255,122,24,0.18)]"
        aria-label="Create character"
      >
        <Plus className="h-5 w-5" />
      </Link>
    </div>
  );
}

function CharacterTile({
  character,
  active,
  onSelect,
  onStart
}: {
  character: HomeCharacter;
  active: boolean;
  onSelect: () => void;
  onStart: () => void;
}) {
  return (
    <article
      className={cn(
        "group relative h-[365px] overflow-hidden rounded-2xl border bg-[#0d1118] shadow-[0_18px_36px_rgba(0,0,0,0.35)] transition",
        active ? "border-[#ff7a18]/55" : "border-white/[0.16] hover:border-[#ff7a18]/38"
      )}
      onMouseEnter={onSelect}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <div className="relative h-[205px] overflow-hidden">
          <img src={character.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/8 to-[#080b10]/72" />
          <Heart className="absolute right-4 top-4 h-5 w-5 text-white/88 drop-shadow" />
        </div>
      </button>
      <div className="px-5 pb-16 pt-3">
        <h2 className="truncate text-xl font-semibold leading-6 tracking-[-0.02em] text-white">{character.name}</h2>
        <p className="mt-1 truncate text-sm text-white/72">{character.subtitle}</p>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-white/48">{character.description}</p>
        <button
          type="button"
          onClick={onStart}
          className="absolute inset-x-5 bottom-4 flex h-9 items-center justify-center gap-2 rounded-full border border-[#ff7a18]/55 bg-[#5b250d]/70 text-xs text-[#ffb347] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_20px_rgba(255,122,24,0.18)] transition hover:bg-[#743011]/80"
        >
          <MessageCircle className="h-4 w-4" />
          Start Chat
        </button>
      </div>
    </article>
  );
}

function ChatPreview({ character }: { character: HomeCharacter }) {
  return (
    <section className="relative hidden min-h-0 overflow-hidden bg-[#07090e] lg:block">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,122,24,0.13),transparent_34%)]" />
      <header className="relative z-10 flex h-[92px] items-center gap-4 border-b border-white/[0.14] bg-black/24 px-7 backdrop-blur-xl">
        <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-white/86 transition hover:bg-white/[0.08]" aria-label="Back">
          <ArrowRight className="h-6 w-6 rotate-180" />
        </button>
        <img src={character.avatar} alt="" className="h-12 w-12 rounded-full border border-white/18 object-cover" />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-[-0.01em] text-white">{character.name}</h2>
          <p className="truncate text-sm text-white/58">{character.subtitle}</p>
        </div>
        <div className="ml-auto flex gap-3">
          <IconCircle label="Favorite">
            <Star className="h-5 w-5" />
          </IconCircle>
          <IconCircle label="More">
            <MoreVertical className="h-5 w-5" />
          </IconCircle>
        </div>
      </header>

      <div className="absolute inset-x-0 bottom-[116px] top-[92px] overflow-hidden">
        <img src="/nythera-showcase/chat-raven-scene.png" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#07090e] to-transparent" />
      </div>

      <div className="absolute bottom-[132px] left-20 z-10 flex flex-wrap gap-3">
        <QuickAction icon={UserRound} label="Persona" />
        <QuickAction icon={Sparkles} label="Memory" />
        <QuickAction icon={History} label="Chat History" />
        <QuickAction icon={BookOpen} label="Details" />
        <QuickAction icon={RefreshCcw} label="Regenerate" />
      </div>

      <div className="absolute inset-x-4 bottom-2 z-10">
        <div className="flex h-[70px] items-center gap-5 rounded-full border border-white/[0.18] bg-[#111720]/78 px-7 shadow-[0_14px_44px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
          <Paperclip className="h-6 w-6 text-white/82" />
          <input aria-label="Message" placeholder="Message..." className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/42" />
          <Smile className="h-6 w-6 text-white/82" />
          <button type="button" aria-label="Send" className="grid h-12 w-12 place-items-center rounded-full bg-[#ff7a18] text-white shadow-[0_0_24px_rgba(255,122,24,0.45)]">
            <Send className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-3 text-center text-xs italic text-white/32">Nythera can make mistakes. Consider checking important information.</p>
      </div>
    </section>
  );
}

function MobileChatPreview({ character }: { character: HomeCharacter }) {
  return (
    <section className="relative min-h-[520px] overflow-hidden border-t border-white/[0.12] bg-[#07090e] lg:hidden">
      <img src="/nythera-showcase/chat-raven-scene.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-78" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,6,11,0.25),rgba(3,6,11,0.48)_58%,rgba(3,6,11,0.92))]" />
      <header className="relative z-10 flex h-20 items-center gap-3 border-b border-white/[0.12] bg-black/22 px-4 backdrop-blur-xl">
        <img src={character.avatar} alt="" className="h-11 w-11 rounded-full border border-white/18 object-cover" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-white">{character.name}</h2>
          <p className="truncate text-xs text-white/58">{character.subtitle}</p>
        </div>
        <IconCircle label="Favorite">
          <Star className="h-5 w-5" />
        </IconCircle>
      </header>
      <div className="absolute inset-x-4 bottom-20 z-10 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <QuickAction icon={UserRound} label="Persona" />
        <QuickAction icon={Sparkles} label="Memory" />
        <QuickAction icon={History} label="History" />
        <QuickAction icon={RefreshCcw} label="Regenerate" />
      </div>
      <div className="absolute inset-x-3 bottom-3 z-10 flex h-[62px] items-center gap-3 rounded-full border border-white/[0.18] bg-[#111720]/82 px-5 shadow-[0_14px_44px_rgba(0,0,0,0.48)] backdrop-blur-xl">
        <Paperclip className="h-5 w-5 shrink-0 text-white/82" />
        <input aria-label="Message" placeholder="Message..." className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/42" />
        <Smile className="h-5 w-5 shrink-0 text-white/82" />
        <button type="button" aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#ff7a18] text-white shadow-[0_0_24px_rgba(255,122,24,0.45)]">
          <Send className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}

function IconCircle({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} className="grid h-11 w-11 place-items-center rounded-full border border-white/[0.14] bg-black/18 text-white/86 backdrop-blur-md transition hover:bg-white/[0.08]">
      {children}
    </button>
  );
}

function QuickAction({ icon: Icon, label }: { icon: typeof UserRound; label: string }) {
  return (
    <button type="button" className="inline-flex h-8 items-center gap-2 rounded-full border border-white/[0.18] bg-black/28 px-4 text-xs text-white/76 backdrop-blur-xl transition hover:border-[#ff7a18]/45 hover:text-white">
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

const showcaseSidebarChats = [
  { name: "Raven", avatar: "/nythera-showcase/raven-avatar.png", active: true },
  { name: "Kael Draven", avatar: "/nythera-showcase/kael-avatar.png" },
  { name: "Elara Voss", avatar: "/nythera-showcase/elara-avatar.png" },
  { name: "Zero", avatar: "/nythera-showcase/zero-avatar.png" }
];

function chatToSidebarItem(chat: RecentChat) {
  return {
    name: chat.character.name,
    avatar: chat.character.avatarUrl || "/nythera-showcase/raven-avatar.png",
    active: false
  };
}

function toHomeCharacter(character: CharacterSummary): HomeCharacter | null {
  if (!character.avatarUrl) {
    return null;
  }

  return {
    id: character.id,
    source: "real",
    name: character.name,
    subtitle: character.tags?.[0] || "User-created persona",
    description: character.description || "A real Nythera character ready to chat.",
    image: character.avatarUrl,
    avatar: character.avatarUrl,
    category: mapCategory(character.tags)
  };
}

function mapCategory(tags?: string[]) {
  const normalized = (tags ?? []).map((tag) => tag.toLowerCase());
  if (normalized.includes("fantasy")) return "Fantasy";
  if (normalized.includes("sci-fi") || normalized.includes("scifi") || normalized.includes("cyberpunk")) return "Sci-Fi";
  if (normalized.includes("romance")) return "Romance";
  if (normalized.includes("trending")) return "Trending";
  return "For You";
}
