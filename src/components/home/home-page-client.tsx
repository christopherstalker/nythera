"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Heart,
  LoaderCircle,
  MessageCircle,
  Plus,
  Search,
  Sparkles
} from "lucide-react";
import { motion } from "motion/react";
import { RichMessageText } from "@/components/chat/rich-message-text";
import { CharacterCard, type CharacterSummary } from "@/components/characters/CharacterCard";
import { SearchBar } from "@/components/ui/search-bar";
import { Button } from "@/components/ui/button";
import { ResponsiveActions } from "@/components/ui/responsive-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/ui/page";
import { ServiceUnavailable } from "@/components/system/service-unavailable";
import { BRAND_ICON_LARGE } from "@/lib/brand";
import { DISCOVERY_TAGS, displayTagLabel } from "@/lib/character-tags";
import { toChatPreview } from "@/lib/chat-preview";
import { shouldBypassNextImageOptimization } from "@/lib/image-cache";
import { springSoft } from "@/lib/motion";
import { PATREON_SUPPORT_URL } from "@/lib/support";

type RecentChat = {
  id: string;
  title?: string | null;
  character: {
    id: string;
    name: string;
    description?: string | null;
    avatarUrl?: string | null;
  };
  messages: Array<{ content: string; role?: string }>;
};

export default function HomePageClient({
  initialCharacters,
  initialRecentChats,
  isServiceUnavailable = false
}: {
  initialCharacters: CharacterSummary[];
  initialRecentChats: RecentChat[];
  isServiceUnavailable?: boolean;
}) {
  const router = useRouter();
  const characters = initialCharacters;
  const recentChats = initialRecentChats;

  const featured = characters[0];
  const [startingChat, setStartingChat] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatRequestPending = useRef(false);
  async function startFeaturedChat() {
    if (!featured || chatRequestPending.current) {
      return;
    }
    chatRequestPending.current = true;
    setStartingChat(true);
    setChatError("");
    try {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ characterId: featured.id })
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (response.status === 403) {
        const body = await response.json().catch(() => null);
        if (typeof body?.error === "string" && body.error.includes("Adult consent")) {
          router.push("/auth/new-user?callbackUrl=/");
          return;
        }
      }

      if (!response.ok) {
        router.push(`/character/${featured.id}`);
        return;
      }

      const body = await response.json();
      router.push(`/chat/${body.chat.id}`);
    } catch {
      setChatError("Couldn’t start the chat. Please try again.");
    } finally {
      chatRequestPending.current = false;
      setStartingChat(false);
    }
  }

  if (isServiceUnavailable) {
    return (
      <PageShell className="space-y-12">
        <HomeSeoIntro />
        <ServiceUnavailable />
      </PageShell>
    );
  }

  if (!featured) {
    return (
      <PageShell className="space-y-12">
        <HomeSeoIntro />
        <EmptyState
          icon={Search}
          title="No public characters yet"
          description="Only characters created by users are shown here. Create a character to start building Nythera."
          action={
            <Button asChild>
              <Link href="/create-character">
                <Plus className="h-4 w-4" />
                Create character
              </Link>
            </Button>
          }
        />
      </PageShell>
    );
  }

  return (
    <div className="codex-home relative min-h-full overflow-hidden">
      <PageShell className="relative z-10 space-y-8 sm:space-y-10">
        <HomeSeoIntro />
        <FeaturedCharacterHero
          character={featured}
          onStartChat={startFeaturedChat}
          startingChat={startingChat}
          chatError={chatError}
        />
        <BrowseRoleplayThemes />
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-90px" }}
          transition={springSoft}
          className="space-y-6"
        >
          <SectionTitle icon={Sparkles} title="Find your next story" href="/explore" />
          <div className="codex-character-gallery">
            {characters.slice(0, 8).map((character) => (
              <CharacterCard key={character.id} character={character} presentation="discovery" />
            ))}
          </div>
        </motion.section>

        {recentChats.length ? (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-90px" }}
            transition={springSoft}
            className="space-y-6"
          >
            <SectionTitle icon={MessageCircle} title="Recent chats" href="/chats" />
            <div className="codex-recent-index divide-y divide-[var(--codex-rule)] border-y border-[var(--codex-rule)] md:grid md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
              {recentChats.slice(0, 4).map((chat) => (
                <RecentChatCard key={chat.id} chat={chat} />
              ))}
            </div>
          </motion.section>
        ) : null}
        <PatreonPoster />
      </PageShell>
    </div>
  );
}

function PatreonPoster() {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-90px" }}
      transition={springSoft}
      className="relative overflow-hidden rounded-xl border border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] px-5 py-6 sm:px-7"
      aria-labelledby="patreon-support-title"
    >
      <div className="grid gap-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#ff8990]">
            Keep Nythera independent
          </p>
          <h2
            id="patreon-support-title"
            className="font-editorial mt-3 text-3xl font-medium text-[var(--codex-ivory)] sm:text-4xl"
          >
            Help the stories grow.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            Help an independent home for your imagination grow. Support Nythera on Patreon.
          </p>
        </div>
        <Button asChild variant="secondary">
          <a href={PATREON_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
            <Heart className="h-4 w-4" />
            Support on Patreon
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </motion.aside>
  );
}

function FeaturedCharacterHero({
  character,
  onStartChat,
  startingChat,
  chatError
}: {
  character: CharacterSummary;
  onStartChat: () => void;
  startingChat: boolean;
  chatError: string;
}) {
  const avatarSrc = character.avatarUrl || BRAND_ICON_LARGE;

  return (
    <section className="codex-featured-stage grid overflow-hidden rounded-2xl border border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] lg:grid-cols-[minmax(340px,.82fr)_minmax(0,1.3fr)]">
      <div className="relative min-h-[240px] overflow-hidden sm:min-h-[300px] lg:min-h-[380px]">
        <Image
          src={avatarSrc}
          alt={character.name}
          fill
          priority
          unoptimized={shouldBypassNextImageOptimization(avatarSrc)}
          sizes="(min-width: 1024px) 44vw, 100vw"
          className="absolute inset-0 h-full w-full object-cover object-center"
          style={{ objectPosition: "center 18%" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--codex-paper)] via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-[var(--codex-paper)]" />
      </div>
      <div className="flex items-center p-5 sm:p-8 lg:p-10">
        <motion.div
          initial={false}
          transition={springSoft}
          className="flex min-w-0 max-w-2xl flex-col items-start gap-5"
        >
          <p className="text-[10px] font-medium uppercase tracking-[.3em] text-[var(--codex-violet)]">
            Featured story · Volume I
          </p>
          <div className="flex flex-col gap-3">
            <h2 className="font-editorial max-w-full break-words text-[clamp(2.75rem,5vw,5rem)] font-medium leading-[.98] tracking-[-.035em] text-[var(--codex-ivory)]">
              {character.name}
            </h2>
            <p className="line-clamp-3 max-w-xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
              <RichMessageText
                text={character.description || "Start a new character chat and settle into the first scene."}
              />
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {character.tags?.slice(0, 3).map((tag) => (
              <Link key={tag} href={`/explore?tag=${encodeURIComponent(tag)}`} className="codex-theme-chip focus-ring">
                {displayTagLabel(tag)}
              </Link>
            ))}
          </div>
          <ResponsiveActions className="gap-3">
            <Button
              type="button"
              size="lg"
              onClick={onStartChat}
              disabled={startingChat}
              aria-busy={startingChat}
              className="px-6"
            >
              {startingChat ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              {startingChat ? "Starting…" : "Start Chat"}
            </Button>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="border-[var(--border-subtle)] bg-[color-mix(in_oklch,var(--color-surface)_64%,transparent)]"
            >
              <Link href={`/character/${character.id}`}>
                View profile
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </ResponsiveActions>
          {chatError ? (
            <p role="alert" className="text-sm text-danger">
              {chatError}
            </p>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}

function HomeSeoIntro() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  return (
    <header className="codex-home-intro">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--codex-rule)] pb-4">
        <Link href="/" className="font-editorial text-2xl text-[var(--codex-ivory)] no-underline md:hidden">
          Nythera
        </Link>
        <p className="text-[10px] font-medium uppercase tracking-[.22em] text-[var(--codex-mint)]">
          Your next chapter starts here
        </p>
        <Link
          href="/ai-roleplay"
          className="focus-ring inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] no-underline"
        >
          New to roleplay? <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid gap-5 py-6 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-10">
        <div>
          <h1 className="font-editorial max-w-2xl text-[clamp(2.8rem,4.5vw,4.75rem)] font-medium leading-[.98] tracking-[-.035em] text-[var(--codex-ivory)]">
            Stories that remember you.
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--text-secondary)]">
            Discover AI characters, build a world of your own, and pick up right where you left off.
          </p>
        </div>
        <div className="space-y-3">
          <SearchBar
            value={query}
            onChange={setQuery}
            onClear={() => setQuery("")}
            onSubmit={(value) =>
              router.push(value.trim() ? `/explore?q=${encodeURIComponent(value.trim())}` : "/explore")
            }
            placeholder="Find a character, a world, a story…"
          />
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link
              href="/explore"
              className="focus-ring inline-flex min-h-8 items-center gap-1.5 text-xs text-[var(--codex-mint)] no-underline"
            >
              Explore characters <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/create-character"
              className="focus-ring inline-flex min-h-8 items-center gap-1.5 text-xs text-[var(--text-secondary)] no-underline"
            >
              <Plus className="h-3.5 w-3.5" /> Create character
            </Link>
            <Link
              href="/chats"
              className="focus-ring inline-flex min-h-8 items-center gap-1.5 text-xs text-[var(--text-secondary)] no-underline"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Your chats
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

function BrowseRoleplayThemes() {
  return (
    <nav aria-label="Browse roleplay themes" className="space-y-3">
      <p className="text-xs text-[var(--text-secondary)]">Where will your imagination take you?</p>
      <div className="flex flex-wrap gap-2">
        {DISCOVERY_TAGS.slice(0, 8).map((tag) => (
          <Link key={tag.slug} href={`/tags/${tag.slug}`} className="codex-theme-chip focus-ring">
            {tag.label}
          </Link>
        ))}
        <Link href="/explore" className="codex-theme-chip focus-ring gap-1.5">
          All themes <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </nav>
  );
}

function RecentChatCard({ chat }: { chat: RecentChat }) {
  const lastMessage = chat.messages.at(-1)?.content;
  const avatarSrc = chat.character.avatarUrl || BRAND_ICON_LARGE;

  return (
    <motion.article
      whileHover={{ y: -4, scale: 1.01 }}
      transition={springSoft}
      className="relative overflow-hidden bg-transparent"
    >
      <Link href={`/chat/${chat.id}`} className="flex items-center gap-3 px-3 py-5 no-underline sm:px-5">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[var(--border-subtle)]">
          <Image
            src={avatarSrc}
            alt={chat.character.name}
            fill
            unoptimized={shouldBypassNextImageOptimization(avatarSrc)}
            sizes="56px"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-editorial truncate text-xl font-medium text-[var(--codex-ivory)]">
            {chat.character.name}
          </h3>
          <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">
            {toChatPreview(lastMessage || chat.character.description || "Continue chat")}
          </p>
        </div>
        <span
          className="h-2.5 w-2.5 rounded-full bg-[oklch(var(--color-accent-secondary))] shadow-glow-soft"
          aria-hidden
        />
      </Link>
    </motion.article>
  );
}

function SectionTitle({ icon: Icon, title, href }: { icon: typeof Sparkles; title: string; href: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="font-editorial flex items-center gap-3 text-3xl font-medium text-[var(--codex-ivory)]">
        <span className="grid h-8 w-8 place-items-center rounded-full border border-[var(--codex-rule)] text-[var(--codex-mint)]">
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h2>
      <Link
        href={href}
        className="focus-ring inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--text-secondary)] no-underline hover:text-[var(--text-primary)]"
      >
        View all
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
