"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ExternalLink, Heart, MessageCircle, Plus, Search, ShieldAlert, Sparkles, Star } from "lucide-react";
import { motion } from "motion/react";
import { RichMessageText } from "@/components/chat/rich-message-text";
import type { CharacterSummary } from "@/components/characters/CharacterCard";
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
import { cn } from "@/lib/utils";

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
  const [recentChats, setRecentChats] = useState(initialRecentChats);

  useEffect(() => {
    if (isServiceUnavailable || initialRecentChats.length) {
      return;
    }

    const controller = new AbortController();
    void fetch("/api/chats", { signal: controller.signal })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (Array.isArray(body?.chats)) {
          setRecentChats(body.chats.slice(0, 8));
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [initialRecentChats.length, isServiceUnavailable]);

  const featured = useMemo(() => characters[0], [characters]);
  async function startFeaturedChat() {
    if (!featured) {
      return;
    }

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
      <PageShell className="relative z-10 space-y-16">
        <HomeSeoIntro />
        <FeaturedCharacterHero character={featured} onStartChat={startFeaturedChat} />
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-90px" }}
          transition={springSoft}
          className="space-y-6"
        >
          <SectionTitle icon={Sparkles} title="Characters" href="/explore" />
          <div className="codex-character-index grid grid-cols-1 border-t border-[var(--codex-rule)] sm:grid-cols-2 xl:grid-cols-6">
            {characters.slice(0, 6).map((character, index) => (
              <HomeCharacterCard
                key={character.id}
                character={character}
                featured={index === 0}
                className={cn(index === 0 && "sm:col-span-2 xl:col-span-2")}
              />
            ))}
          </div>
        </motion.section>

        <BrowseRoleplayThemes />

        <PatreonPoster />

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
      className="relative overflow-hidden border-y border-[#ff424d]/35 bg-[#ff424d]/[0.035] px-5 py-8 sm:px-8 sm:py-10"
      aria-labelledby="patreon-support-title"
    >
      <div className="absolute inset-y-0 left-0 w-px bg-[#ff5963] shadow-[0_0_24px_rgba(255,66,77,.45)]" aria-hidden="true" />
      <div className="grid gap-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#ff8990]">Keep Nythera independent</p>
          <h2 id="patreon-support-title" className="font-editorial mt-3 text-3xl font-medium text-[var(--codex-ivory)] sm:text-4xl">
            Help the stories grow.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            Patreon support helps fund model access, infrastructure, memory improvements, and the next generation of character tools.
          </p>
        </div>
        <Button asChild size="lg" className="border border-[#ff5963]/60 bg-[#ff424d] text-white hover:bg-[#ff5963]">
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
  onStartChat
}: {
  character: CharacterSummary;
  onStartChat: () => void;
}) {
  const avatarSrc = character.avatarUrl || BRAND_ICON_LARGE;

  return (
    <section className="codex-featured-stage grid min-h-[min(720px,78dvh)] overflow-hidden border-y border-[var(--codex-rule)] lg:grid-cols-[minmax(340px,.82fr)_minmax(0,1.3fr)]">
      <div className="relative order-2 min-h-[360px] overflow-hidden lg:order-1 lg:min-h-full">
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
      <div className="order-1 flex items-center p-6 sm:p-10 lg:order-2 lg:p-14 xl:p-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springSoft}
          className="flex max-w-2xl flex-col items-start gap-7"
        >
          <p className="text-[10px] font-medium uppercase tracking-[.3em] text-[var(--codex-violet)]">Featured story · Volume I</p>
          <div className="flex flex-col gap-3">
            <h2
              className="font-editorial max-w-3xl font-medium leading-[.82] tracking-[-.045em] text-[var(--codex-ivory)]"
              style={{ fontSize: "clamp(4rem, 10vw, 8rem)" }}
            >
              {character.name}
            </h2>
            <p className="line-clamp-4 max-w-xl text-base leading-7 text-[var(--text-secondary)] md:text-lg">
              <RichMessageText text={character.description || "Start a new character chat and settle into the first scene."} />
            </p>
          </div>
          <ResponsiveActions className="gap-3">
            <Button
              type="button"
              size="lg"
              onClick={onStartChat}
              className="px-6"
            >
              <Sparkles className="h-4 w-4" />
              Start Chat
            </Button>
            <Button asChild variant="secondary" size="lg" className="border-[var(--border-subtle)] bg-[color-mix(in_oklch,var(--color-surface)_64%,transparent)]">
              <Link href={`/character/${character.id}`}>
                Profile
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </ResponsiveActions>
        </motion.div>
      </div>
    </section>
  );
}

function HomeSeoIntro() {
  return (
    <header className="grid gap-8 border-b border-[var(--codex-rule)] pb-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,.6fr)] lg:items-end">
      <div>
        <p className="mb-3 text-[10px] font-medium uppercase tracking-[.3em] text-[var(--codex-violet)]">
          Nythera / AI roleplay universe
        </p>
        <h1 className="font-editorial max-w-5xl text-[clamp(3.7rem,9vw,8.5rem)] font-medium leading-[.78] tracking-[-.05em] text-[var(--codex-ivory)]">
          Stories that remember you.
        </h1>
      </div>
      <div className="space-y-5 lg:pb-2">
        <p className="font-editorial text-xl italic leading-8 text-[var(--text-secondary)]">
          Create and discover AI roleplay characters with persistent persona, memory, and story continuity.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/explore">
              Explore characters
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/ai-roleplay">What is AI roleplay?</Link>
          </Button>
          <Button asChild variant="outline" className="border-[rgb(255_66_77_/_0.5)] text-[rgb(255_157_163)] hover:border-[rgb(255_122_130)] hover:bg-[rgb(255_66_77_/_0.06)]">
            <a href={PATREON_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
              <Heart className="h-4 w-4" />
              Patreon
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}

function BrowseRoleplayThemes() {
  return (
    <nav aria-label="Browse roleplay themes" className="border-y border-[var(--codex-rule)] py-7">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="codex-kicker">Find your next story</p>
          <h2 className="font-editorial mt-1 text-3xl font-medium text-[var(--codex-ivory)]">Browse roleplay themes</h2>
        </div>
        <div className="flex max-w-3xl flex-wrap gap-x-5 gap-y-3">
          {DISCOVERY_TAGS.slice(0, 10).map((tag) => (
            <Link
              key={tag.slug}
              href={`/tags/${tag.slug}`}
              className="focus-ring border-b border-[var(--codex-rule)] pb-1 text-xs uppercase tracking-[.14em] text-[var(--text-secondary)] no-underline transition-colors hover:border-[var(--codex-mint)] hover:text-[var(--codex-mint)]"
            >
              {tag.label}
            </Link>
          ))}
        </div>
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
          <h3 className="font-editorial truncate text-xl font-medium text-[var(--codex-ivory)]">{chat.character.name}</h3>
          <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">
            {toChatPreview(lastMessage || chat.character.description || "Continue chat")}
          </p>
        </div>
        <span className="h-2.5 w-2.5 rounded-full bg-[oklch(var(--color-accent-secondary))] shadow-glow-soft" aria-hidden />
      </Link>
    </motion.article>
  );
}

function HomeCharacterCard({
  character,
  featured = false,
  className
}: {
  character: CharacterSummary;
  featured?: boolean;
  className?: string;
}) {
  const avatarSrc = character.avatarUrl || BRAND_ICON_LARGE;

  return (
    <motion.article
      whileHover={{ y: -6, scale: 1.015 }}
      transition={springSoft}
      className={cn(
        "group relative min-h-[280px] overflow-hidden border-b border-r border-[var(--codex-rule)]",
        featured ? "sm:min-h-[360px] xl:min-h-[420px]" : "xl:min-h-[300px]",
        className
      )}
    >
      <Link href={`/character/${character.id}`} className="absolute inset-0 block overflow-hidden no-underline" aria-label={`Open ${character.name}`}>
        <Image
          src={avatarSrc}
          alt={character.name}
          fill
          unoptimized={shouldBypassNextImageOptimization(avatarSrc)}
          sizes={featured ? "(min-width: 1280px) 33vw, 100vw" : "(min-width: 1280px) 16vw, 50vw"}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center 20%" }}
        />
        <div className="absolute left-3 right-3 top-3 z-10 flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-[var(--text-primary)]"
            style={{
              background: "color-mix(in oklch, var(--color-surface) 54%, transparent)",
              backdropFilter: "blur(var(--glass-blur-sm))"
            }}
          >
            <Star className="h-3.5 w-3.5 text-[oklch(var(--color-accent-secondary))]" />
            {(character.ratingAverage ?? 0).toFixed(1)}
          </span>
          {character.isNSFW ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-[var(--text-primary)]"
              style={{ background: "oklch(var(--color-danger) / .74)" }}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              18+
            </span>
          ) : null}
        </div>
        <div
          className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end p-4"
          style={{
            minHeight: featured ? "64%" : "58%",
            background:
              "linear-gradient(to top, oklch(var(--color-canvas) / .94) 0%, oklch(var(--color-canvas) / .64) 58%, transparent 100%)"
          }}
        >
          <h3 className={cn("font-editorial font-medium leading-tight text-[var(--codex-ivory)]", featured ? "line-clamp-2 text-4xl" : "line-clamp-1 text-2xl")}>
            {character.name}
          </h3>
          <p className={cn("mt-1 text-sm leading-6 text-[var(--text-secondary)]", featured ? "line-clamp-3" : "line-clamp-2")}>
            <RichMessageText text={character.description || "A story waiting to begin."} />
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {character.tags?.slice(0, featured ? 3 : 2).map((tag) => (
              <span
                key={tag}
                className="max-w-[8rem] truncate rounded-full px-2 py-1 text-xs font-medium text-[var(--text-primary)]"
                style={{
                  background: "color-mix(in oklch, var(--color-surface) 44%, transparent)",
                  backdropFilter: "blur(var(--glass-blur-sm))",
                  boxShadow: "var(--glass-highlight)"
                }}
              >
                {displayTagLabel(tag)}
              </span>
            ))}
          </div>
          <span className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Heart className="h-3.5 w-3.5" />
            {character.likes ?? 0}
          </span>
        </div>
      </Link>
    </motion.article>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  href
}: {
  icon: typeof Sparkles;
  title: string;
  href: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="font-editorial flex items-center gap-3 text-4xl font-medium text-[var(--codex-ivory)]">
        <span className="grid h-8 w-8 place-items-center rounded-full border border-[var(--codex-rule)] text-[var(--codex-mint)]">
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h2>
      <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-secondary)] no-underline hover:text-[var(--text-primary)]">
        View all
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
