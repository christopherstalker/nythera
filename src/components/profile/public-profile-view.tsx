"use client";

import { type CSSProperties, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Copy,
  Heart,
  MessageCircle,
  Share2,
  Sparkles,
  Twitter
} from "lucide-react";
import { RichMessageText } from "@/components/chat/rich-message-text";
import { MusicEmbedPlayer } from "@/components/music/MusicEmbedPlayer";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PROFILE_CUSTOM_FONT_FAMILY, useCustomFontFace } from "@/hooks/use-custom-font";
import { PROFILE_THEME_PRESETS, type ProfileSettings } from "@/lib/profile-settings";
import { cn } from "@/lib/utils";

type PublicCharacter = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  description?: string | null;
  _count?: { chats: number };
};

const SOCIAL_LINKS = {
  twitter: { icon: Twitter, label: "Twitter" },
  patreon: { icon: Heart, label: "Patreon" },
  discord: { icon: MessageCircle, label: "Discord" }
} as const;

export function PublicProfileView({
  username,
  bio,
  avatarUrl,
  accentColor,
  settings,
  characters,
  isOwner = false,
  previewMode = "visitor"
}: {
  username: string;
  bio?: string | null;
  avatarUrl?: string | null;
  accentColor?: string | null;
  settings: ProfileSettings;
  characters: PublicCharacter[];
  isOwner?: boolean;
  previewMode?: "visitor" | "owner";
}) {
  const [copied, setCopied] = useState(false);
  const theme = PROFILE_THEME_PRESETS[settings.themePreset ?? "midnight"];
  const showAsVisitor = previewMode === "visitor";
  const featured = characters[0];
  const remainingCharacters = settings.layoutStyle === "showcase" ? characters.slice(1) : characters;
  const socialLinks = Object.entries(settings.socialLinks ?? {}).flatMap(([network, value]) => {
    const url = safeExternalUrl(value);
    const details = SOCIAL_LINKS[network as keyof typeof SOCIAL_LINKS];
    return url && details ? [{ network, url, ...details }] : [];
  });

  useCustomFontFace(settings.fontUrl, PROFILE_CUSTOM_FONT_FAMILY);

  const profileStyle = {
    "--profile-accent": accentColor ?? "#8F81F7",
    "--profile-theme": theme.gradient,
    "--profile-glass-tint": theme.glassTint,
    fontFamily: `'${(settings.fontUrl ? PROFILE_CUSTOM_FONT_FAMILY : settings.fontFamily ?? "Inter").replaceAll("'", "")}', sans-serif`,
    fontSize: `${settings.fontScale ?? 1}rem`
  } as CSSProperties;
  const patreonUrl = safeExternalUrl(settings.socialLinks?.patreon);
  const bannerHeight = settings.bannerHeight === "compact" ? "h-48 sm:h-56" : settings.bannerHeight === "immersive" ? "h-72 sm:h-96" : "h-60 sm:h-72";
  const avatarShape = settings.avatarShape === "square" ? "rounded-sm" : settings.avatarShape === "soft" ? "rounded-[26px]" : "rounded-full";

  function profileUrl() {
    return `${window.location.origin}/u/${username}`;
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(profileUrl());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function shareProfile() {
    if (!navigator.share) {
      await copyUrl();
      return;
    }

    try {
      await navigator.share({ title: `${username} on Nythera`, url: profileUrl() });
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "AbortError") throw error;
    }
  }

  return (
    <article
      className="nythera-profile neo-glass-panel relative isolate overflow-hidden"
      data-surface={settings.surfaceStyle ?? "glass"}
      style={profileStyle}
    >
      <div className="pointer-events-none absolute inset-0 -z-20 opacity-55" style={{ background: theme.gradient }} />

      <header className={cn("profile-banner-art relative overflow-hidden", bannerHeight)}>
        {!settings.useGradientBanner && settings.bannerUrl ? (
          <Image
            src={settings.bannerUrl}
            alt={`${username}'s profile cover`}
            fill
            className="z-0 object-cover [mask-image:linear-gradient(to_bottom,black_0%,black_68%,transparent_100%)]"
            unoptimized
            priority
          />
        ) : null}
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/10 via-transparent to-black/15" />
        <div className="absolute inset-x-5 top-5 z-[3] flex items-center justify-between gap-4 sm:inset-x-8 sm:top-7">
          <span className="border border-white/15 bg-black/20 px-3 py-2 font-mono text-[9px] uppercase tracking-[.24em] text-white/75 backdrop-blur-md">
            Nythera / Creator archive
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[.24em] text-white/65">
            {String(characters.length).padStart(2, "0")} public worlds
          </span>
        </div>
        <div className="absolute bottom-7 right-8 z-[3] hidden items-center gap-3 text-white/55 sm:flex">
          <span className="h-px w-14 bg-current" />
          <span className="font-editorial text-lg italic">An authored universe</span>
        </div>
      </header>

      <div className="relative px-5 pb-8 sm:px-8 sm:pb-10 lg:px-10 lg:pb-12">
        <div className="-mt-16 flex flex-col gap-5 sm:-mt-20 sm:flex-row sm:items-end sm:justify-between">
          <span
            className={cn(
              "relative shrink-0 border bg-[color-mix(in_oklch,var(--bg-elevated)_88%,transparent)] p-1.5 shadow-[0_22px_70px_oklch(0_0_0/.38)] backdrop-blur-xl",
              "self-start",
              avatarShape
            )}
            style={{ borderColor: "color-mix(in oklch, var(--profile-accent) 78%, white 18%)" }}
          >
            <Avatar
              name={username}
              src={avatarUrl}
              size="xl"
              className={cn("h-28 w-28 border-0 sm:h-36 sm:w-36", avatarShape)}
            />
            <span
              className="absolute bottom-2 right-2 h-3.5 w-3.5 rounded-full border-2 border-[var(--bg-elevated)] bg-[var(--profile-accent)]"
              title="Public profile"
            />
          </span>

          <div className="flex flex-wrap gap-2 sm:justify-end sm:pb-1">
            {!showAsVisitor ? (
              <Button variant="outline" size="sm" onClick={() => void copyUrl()}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Link copied" : "Copy link"}
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void shareProfile()}>
              {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              {copied ? "Link copied" : "Share profile"}
            </Button>
            {showAsVisitor && patreonUrl ? (
              <Button asChild size="sm">
                <a href={patreonUrl} target="_blank" rel="noopener noreferrer">
                  <Heart className="h-4 w-4" />
                  Support creator
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-7 grid gap-7 border-b border-[var(--border-default)] pb-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-end lg:gap-12 lg:pb-10">
          <div className="min-w-0">
            <p className="font-mono text-[9px] font-medium uppercase tracking-[.28em] text-[var(--profile-accent)]">
              Independent creator
            </p>
            <h1 className="mt-3 break-words font-editorial text-[clamp(2.8rem,8vw,5.5rem)] font-medium leading-[.82] tracking-[-.045em] text-[var(--text-primary)]">
              {username}
            </h1>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[.16em] text-[var(--text-muted)]">@{username}</p>
            {bio ? (
              <RichMessageText
                text={bio}
                className="mt-6 max-w-2xl font-editorial text-xl italic leading-8 text-[var(--text-secondary)] sm:text-2xl"
              />
            ) : (
              <p className="mt-6 max-w-xl font-editorial text-xl italic leading-8 text-[var(--text-muted)]">
                A collection of characters, stories, and worlds waiting to be entered.
              </p>
            )}
          </div>

          <dl className="grid grid-cols-2 border border-[var(--border-default)] bg-[color-mix(in_oklch,var(--profile-glass-tint)_72%,transparent)] lg:grid-cols-1">
            <ProfileStat value={String(characters.length).padStart(2, "0")} label="Public characters" />
            <ProfileStat value="Open" label="Archive access" />
          </dl>
        </div>

        {socialLinks.length ? (
          <nav className="mt-5 flex flex-wrap gap-x-6 gap-y-3" aria-label={`${username}'s social links`}>
            {socialLinks.map(({ network, url, icon: Icon, label }) => (
              <a
                key={network}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.12em] text-[var(--text-muted)] no-underline transition-colors hover:text-[var(--profile-accent)]"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            ))}
          </nav>
        ) : null}

        {settings.music?.enabled ? <MusicEmbedPlayer music={settings.music} className="mt-7 max-w-2xl" /> : null}

        <section className="mt-11" aria-label={`${username}'s characters`}>
          <div className="mb-6 grid gap-5 border-b border-[var(--border-default)] pb-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end">
            <span className="hidden h-10 w-10 place-items-center border border-[var(--border-default)] text-[var(--profile-accent)] sm:grid">
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <p className="font-mono text-[9px] font-medium uppercase tracking-[.26em] text-[var(--profile-accent)]">Created worlds</p>
              <h2 className="mt-2 font-editorial text-4xl font-medium leading-none tracking-[-.03em] text-[var(--text-primary)] sm:text-5xl">
                Character archive
              </h2>
            </div>
            <p className="font-editorial text-lg italic text-[var(--text-muted)]">{characters.length} entries</p>
          </div>

          {settings.layoutStyle === "showcase" && featured ? <FeaturedCharacter character={featured} /> : null}
          {remainingCharacters.length ? (
            <div
              className={cn(
                "grid gap-3",
                settings.layoutStyle === "showcase" && "mt-3",
                settings.layoutStyle === "minimal" ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3"
              )}
            >
              {remainingCharacters.map((character, index) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  index={index + (settings.layoutStyle === "showcase" ? 2 : 1)}
                  minimal={settings.layoutStyle === "minimal"}
                />
              ))}
            </div>
          ) : null}
          {!characters.length ? (
            <div className="border border-dashed border-[var(--border-default)] bg-[color-mix(in_oklch,var(--profile-glass-tint)_42%,transparent)] px-5 py-16 text-center sm:py-20">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[var(--border-default)] text-[var(--profile-accent)]" aria-hidden>
                <Sparkles className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-editorial text-2xl font-medium text-[var(--text-primary)]">The archive is still being written</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">
                {isOwner ? "Publish a character to begin building your public collection." : "No public characters have been released yet. Check back for the first chapter."}
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </article>
  );
}

function ProfileStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-r border-[var(--border-default)] px-4 py-4 last:border-r-0 lg:border-b lg:border-r-0 lg:last:border-b-0">
      <dt className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-2 font-editorial text-2xl font-medium leading-none text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function FeaturedCharacter({ character }: { character: PublicCharacter }) {
  return (
    <Link
      href={`/character/${character.id}`}
      className="profile-character-card neo-glass-card group grid overflow-hidden no-underline md:grid-cols-[minmax(240px,.85fr)_minmax(0,1.15fr)]"
    >
      <CharacterArtwork character={character} className="min-h-64 md:min-h-80" />
      <div className="flex flex-col justify-between p-6 sm:p-8">
        <div>
          <p className="font-mono text-[9px] font-medium uppercase tracking-[.24em] text-[var(--profile-accent)]">Featured character / 01</p>
          <h3 className="mt-4 font-editorial text-4xl font-medium leading-none tracking-[-.03em] text-[var(--text-primary)] sm:text-5xl">
            {character.name}
          </h3>
          <p className="mt-4 line-clamp-4 text-sm leading-7 text-[var(--text-secondary)]">{character.description}</p>
        </div>
        <span className="mt-8 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.14em] text-[var(--profile-accent)]">
          Enter this world
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function CharacterCard({ character, index, minimal }: { character: PublicCharacter; index: number; minimal: boolean }) {
  if (minimal) {
    return (
      <Link
        href={`/character/${character.id}`}
        className="profile-character-card neo-glass-card group grid grid-cols-[2.5rem_auto_minmax(0,1fr)_auto] items-center gap-3 p-3 no-underline sm:gap-5 sm:p-4"
      >
        <span className="font-editorial text-lg italic text-[var(--text-muted)]">{String(index).padStart(2, "0")}</span>
        <Avatar name={character.name} src={character.avatarUrl} size="lg" className="rounded-sm" />
        <div className="min-w-0">
          <h3 className="truncate font-editorial text-2xl font-medium text-[var(--text-primary)]">{character.name}</h3>
          <p className="mt-1 line-clamp-1 text-xs text-[var(--text-secondary)]">{character.description}</p>
        </div>
        <ArrowUpRight className="h-4 w-4 text-[var(--profile-accent)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </Link>
    );
  }

  return (
    <Link href={`/character/${character.id}`} className="profile-character-card neo-glass-card group overflow-hidden no-underline">
      <CharacterArtwork character={character} className="aspect-[4/3]" />
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[8px] uppercase tracking-[.2em] text-[var(--profile-accent)]">Entry {String(index).padStart(2, "0")}</p>
            <h3 className="mt-2 truncate font-editorial text-3xl font-medium leading-none text-[var(--text-primary)]">{character.name}</h3>
          </div>
          <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-[var(--text-muted)] transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--profile-accent)]" />
        </div>
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{character.description}</p>
      </div>
    </Link>
  );
}

function CharacterArtwork({ character, className }: { character: PublicCharacter; className?: string }) {
  return (
    <div
      className={cn(
        "profile-character-artwork relative grid overflow-hidden border-b border-[var(--border-default)] bg-[color-mix(in_oklch,var(--profile-accent)_10%,var(--bg-elevated))]",
        className
      )}
    >
      {character.avatarUrl ? (
        <img src={character.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="m-auto font-editorial text-7xl font-medium text-[color-mix(in_oklch,var(--profile-accent)_55%,transparent)]" aria-hidden>
          {character.name.trim().slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-white/[.04]" />
    </div>
  );
}

function safeExternalUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
