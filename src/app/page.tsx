"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronRight, Heart, MessageCircle, Plus, Search, ShieldAlert, Sparkles, Star } from "lucide-react";
import { motion } from "motion/react";
import type { CharacterSummary } from "@/components/characters/CharacterCard";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/ui/page";
import { displayTagLabel } from "@/lib/character-tags";
import { shouldBypassNextImageOptimization } from "@/lib/image-cache";
import { springSoft } from "@/lib/motion";
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

export default function HomePage() {
  const router = useRouter();
  const { status } = useSession();
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHome() {
      setLoading(true);
      const [charactersResponse, chatsResponse] = await Promise.allSettled([
        fetch("/api/characters?take=36", { signal: controller.signal }),
        status === "authenticated" ? fetch("/api/chats", { cache: "no-store", signal: controller.signal }) : Promise.resolve(null)
      ]);

      if (charactersResponse.status === "fulfilled" && charactersResponse.value.ok) {
        const body = await charactersResponse.value.json().catch(() => null);
        setCharacters(Array.isArray(body?.characters) ? body.characters : []);
      } else {
        setCharacters([]);
      }

      if (chatsResponse.status === "fulfilled" && chatsResponse.value?.ok) {
        const body = await chatsResponse.value.json().catch(() => null);
        setRecentChats(Array.isArray(body?.chats) ? body.chats.slice(0, 8) : []);
      } else {
        setRecentChats([]);
      }

      setLoading(false);
    }

    void loadHome().catch(() => {
      if (!controller.signal.aborted) {
        setCharacters([]);
        setRecentChats([]);
        setLoading(false);
      }
    });

    return () => controller.abort();
  }, [status]);

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

    if (!response.ok) {
      router.push(`/character/${featured.id}`);
      return;
    }

    const body = await response.json();
    router.push(`/chat/${body.chat.id}`);
  }

  if (loading) {
    return <HomeLoading />;
  }

  if (!featured) {
    return (
      <PageShell>
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

function FeaturedCharacterHero({
  character,
  onStartChat
}: {
  character: CharacterSummary;
  onStartChat: () => void;
}) {
  const avatarSrc = character.avatarUrl || "/icons/velora-aurora-v4-512.png";

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
            <h1
              className="font-editorial max-w-3xl font-medium leading-[.82] tracking-[-.045em] text-[var(--codex-ivory)]"
              style={{ fontSize: "clamp(4rem, 10vw, 8rem)" }}
            >
              {character.name}
            </h1>
            <p className="line-clamp-4 max-w-xl text-base leading-7 text-[var(--text-secondary)] md:text-lg">
              {character.description || "Start a new character chat and settle into the first scene."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="lg"
              onClick={onStartChat}
              className="bg-aurora-primary px-6 text-[var(--text-primary)] shadow-glow"
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
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function RecentChatCard({ chat }: { chat: RecentChat }) {
  const lastMessage = chat.messages.at(-1)?.content;
  const avatarSrc = chat.character.avatarUrl || "/icons/velora-aurora-v4-512.png";

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
            {lastMessage || chat.character.description || "Continue chat"}
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
  const avatarSrc = character.avatarUrl || "/icons/velora-aurora-v4-512.png";

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
            {character.description || "A story waiting to begin."}
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

function HomeLoading() {
  return (
    <div className="relative min-h-full overflow-hidden">
      <section className="relative min-h-[clamp(440px,64svh,680px)] w-full overflow-hidden bg-aurora-ambient md:-mt-[var(--top-bar-height)] md:pt-[var(--top-bar-height)]">
        <div className="absolute inset-x-4 bottom-10 max-w-3xl space-y-4 sm:inset-x-8 md:inset-x-12 xl:inset-x-16">
          <div className="h-16 w-3/4 rounded-full bg-[color-mix(in_oklch,var(--color-surface)_72%,transparent)]" />
          <div className="h-5 w-1/2 rounded-full bg-[color-mix(in_oklch,var(--color-surface)_64%,transparent)]" />
          <div className="h-12 w-40 rounded-full bg-aurora-primary opacity-70" />
        </div>
      </section>
      <PageShell className="space-y-4 px-4 pt-6 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className={cn("min-h-[280px] rounded-[20px] border border-[var(--border-subtle)]", index === 0 && "sm:col-span-2 xl:col-span-2")}
              style={{
                background: "color-mix(in oklch, var(--color-surface) 68%, transparent)",
                boxShadow: "var(--shadow-card)"
              }}
            />
          ))}
        </div>
      </PageShell>
    </div>
  );
}
