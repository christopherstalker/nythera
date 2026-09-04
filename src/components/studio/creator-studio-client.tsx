"use client";

import {
  ArrowUpRight,
  Check,
  CircleAlert,
  Clock3,
  Eye,
  Heart,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Sparkles,
  UserRound,
  UsersRound
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { UsernameField } from "@/components/profile/username-field";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { publicProfileUrl } from "@/lib/profile-settings";
import { normalizeUsername, usernameValidationMessage } from "@/lib/username";
import { cn } from "@/lib/utils";

type CreatorProfile = {
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
};

type StudioCharacter = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  description?: string | null;
  visibility: "PRIVATE" | "PUBLIC" | "UNLISTED";
  moderationStatus: "PENDING" | "APPROVED" | "REJECTED";
  likes: number;
  ratingAverage: number;
  ratingCount: number;
  updatedAt: string;
  _count: { chats: number };
};

type VisibilityFilter = "ALL" | StudioCharacter["visibility"];

const visibilityFilters: Array<{ value: VisibilityFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PUBLIC", label: "Published" },
  { value: "PRIVATE", label: "Private" },
  { value: "UNLISTED", label: "Unlisted" }
];

export function CreatorStudioClient() {
  const { status: sessionStatus } = useSession();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [characters, setCharacters] = useState<StudioCharacter[]>([]);
  const [username, setUsername] = useState("");
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState<VisibilityFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    let active = true;

    void Promise.all([
      fetch("/api/profile", { cache: "no-store" }),
      fetch("/api/library", { cache: "no-store" })
    ])
      .then(async ([profileResponse, libraryResponse]) => {
        if (!profileResponse.ok || !libraryResponse.ok) throw new Error("Creator Studio could not be loaded.");
        return Promise.all([profileResponse.json(), libraryResponse.json()]);
      })
      .then(([profileBody, libraryBody]) => {
        if (!active) return;
        setProfile(profileBody.profile ?? null);
        setUsername(profileBody.profile?.username ?? "");
        setCharacters(Array.isArray(libraryBody.mine) ? libraryBody.mine : []);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Creator Studio could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sessionStatus]);

  const totals = useMemo(() => {
    let publicCount = 0;
    let conversations = 0;
    let likes = 0;
    for (const character of characters) {
      if (character.visibility === "PUBLIC") publicCount += 1;
      conversations += character._count.chats;
      likes += character.likes;
    }
    return { publicCount, conversations, likes };
  }, [characters]);

  const filteredCharacters = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return characters.filter((character) => {
      if (visibility !== "ALL" && character.visibility !== visibility) return false;
      return !normalizedQuery || character.name.toLowerCase().includes(normalizedQuery) || character.description?.toLowerCase().includes(normalizedQuery);
    });
  }, [characters, query, visibility]);

  const usernameChanged = normalizeUsername(username) !== normalizeUsername(profile?.username ?? "");
  const usernameError = usernameValidationMessage(username);
  const profileReady = Boolean(profile?.username && profile.avatarUrl && profile.bio?.trim());

  async function saveUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!usernameChanged || usernameError || usernameAvailable !== true) return;

    setSavingUsername(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username })
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not claim this username.");

      setProfile((current) => ({ ...current, username: body.profile.username }));
      setUsername(body.profile.username);
      setStatusMessage("Public address updated.");
      window.dispatchEvent(new CustomEvent("nythera:profile-updated", { detail: { profile: body.profile } }));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not claim this username.");
    } finally {
      setSavingUsername(false);
    }
  }

  if (sessionStatus === "loading" || loading) return <StudioSkeleton />;
  if (sessionStatus === "unauthenticated") return <p className="p-6 text-sm text-[var(--text-secondary)]">Sign in to open Creator Studio.</p>;
  if (loadError) return <StudioError message={loadError} />;

  return (
    <div className="min-w-0 pb-12">
      <header className="relative overflow-hidden border-b border-[var(--codex-rule)] px-5 pb-8 pt-6 sm:px-0 sm:pt-2">
        <div className="pointer-events-none absolute -right-12 top-0 h-52 w-52 rounded-full bg-[var(--codex-mint)]/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="codex-kicker">Creator Studio</p>
            <h1 className="mt-3 font-editorial text-5xl leading-none text-[var(--text-primary)] sm:text-6xl">Your worlds, in one place.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">Build your creator identity, publish characters, and see what your audience is actually engaging with.</p>
          </div>
          <div className="flex flex-col gap-2 xs:flex-row">
            {profile?.username ? <Button asChild variant="secondary"><Link href={publicProfileUrl(profile.username)} target="_blank"><Eye className="h-4 w-4" />Public profile</Link></Button> : null}
            <Button asChild size="lg"><Link href="/create-character"><Plus className="h-4 w-4" />New character</Link></Button>
          </div>
        </div>
      </header>

      <main className="grid min-w-0 gap-8 px-5 pt-8 sm:px-0 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          <section aria-label="Creator overview" className="grid grid-cols-2 gap-px overflow-hidden border border-[var(--codex-rule)] bg-[var(--codex-rule)] lg:grid-cols-4">
            <StudioMetric label="Characters" value={characters.length} icon={Sparkles} />
            <StudioMetric label="Published" value={totals.publicCount} icon={Eye} />
            <StudioMetric label="Conversations" value={totals.conversations} icon={MessageCircle} />
            <StudioMetric label="Likes" value={totals.likes} icon={Heart} />
          </section>

          <section aria-labelledby="studio-characters-title">
            <div className="flex flex-col gap-4 border-b border-[var(--codex-rule)] pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="codex-kicker">Content library</p>
                <h2 id="studio-characters-title" className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">Characters</h2>
              </div>
              <div className="relative w-full lg:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your characters" className="pl-9" />
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto py-4" role="tablist" aria-label="Character visibility">
              {visibilityFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  role="tab"
                  aria-selected={visibility === filter.value}
                  onClick={() => setVisibility(filter.value)}
                  className={cn(
                    "focus-ring min-h-9 shrink-0 rounded-full border px-4 text-xs",
                    visibility === filter.value
                      ? "border-[var(--codex-mint)] bg-[var(--codex-mint)]/10 text-[var(--codex-mint)]"
                      : "border-[var(--codex-rule)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {filteredCharacters.length ? (
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                {filteredCharacters.map((character) => <StudioCharacterCard key={character.id} character={character} />)}
              </div>
            ) : characters.length ? (
              <div className="border border-dashed border-[var(--codex-rule)] px-6 py-14 text-center">
                <Search className="mx-auto h-6 w-6 text-[var(--text-muted)]" />
                <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">No matching characters</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Try another search or visibility filter.</p>
              </div>
            ) : (
              <EmptyStudio />
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start">
          <section className="border border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] p-5">
            <div className="flex items-center gap-3">
              <Avatar name={profile?.username ?? "Creator"} src={profile?.avatarUrl} size="md" className="h-12 w-12" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Creator identity</p>
                <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{profile?.username ? `@${profile.username}` : "Claim your public address"}</p>
              </div>
            </div>

            <form onSubmit={saveUsername} className="mt-5 space-y-3">
              <label htmlFor="studio-username" className="text-[10px] font-medium uppercase tracking-[.14em] text-[var(--text-muted)]">Unique username</label>
              <UsernameField id="studio-username" value={username} onChange={setUsername} onAvailabilityChange={setUsernameAvailable} currentUsername={profile?.username} />
              <Button type="submit" className="w-full" disabled={!usernameChanged || Boolean(usernameError) || usernameAvailable !== true || savingUsername}>
                {savingUsername ? "Saving…" : profile?.username ? "Update address" : "Claim username"}
              </Button>
              {statusMessage ? <p role="status" className="text-xs leading-5 text-[var(--text-secondary)]">{statusMessage}</p> : null}
            </form>

            <div className="mt-5 border-t border-[var(--codex-rule)] pt-4">
              <Button asChild variant="ghost" className="w-full justify-between px-0">
                <Link href="/account"><span className="inline-flex items-center gap-2"><UserRound className="h-4 w-4" />Edit full profile</span><ArrowUpRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          </section>

          <section className="border border-[var(--codex-rule)] p-5">
            <p className="codex-kicker">Publishing checklist</p>
            <div className="mt-4 space-y-4">
              <ChecklistItem done={Boolean(profile?.username)} label="Claim a unique username" />
              <ChecklistItem done={Boolean(profile?.avatarUrl)} label="Add a creator avatar" />
              <ChecklistItem done={Boolean(profile?.bio?.trim())} label="Write your public bio" />
              <ChecklistItem done={totals.publicCount > 0} label="Publish your first character" />
            </div>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[var(--codex-rule)]">
              <div className="h-full bg-[var(--codex-mint)] transition-[width]" style={{ width: `${([Boolean(profile?.username), Boolean(profile?.avatarUrl), Boolean(profile?.bio?.trim()), totals.publicCount > 0].filter(Boolean).length / 4) * 100}%` }} />
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">{profileReady && totals.publicCount > 0 ? "Your creator profile is ready for visitors." : "Complete the basics to make your page feel trustworthy."}</p>
          </section>
        </aside>
      </main>
    </div>
  );
}

function StudioMetric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Sparkles }) {
  return (
    <div className="bg-[var(--codex-paper-raised)] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 text-[var(--text-muted)]"><span className="text-[10px] uppercase tracking-[.14em]">{label}</span><Icon className="h-4 w-4" /></div>
      <p className="mt-5 text-3xl font-medium tabular-nums text-[var(--text-primary)]">{value.toLocaleString()}</p>
    </div>
  );
}

function StudioCharacterCard({ character }: { character: StudioCharacter }) {
  const updatedLabel = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(character.updatedAt));

  return (
    <article className="group min-w-0 border border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] p-4 transition-colors hover:border-[var(--border-strong)]">
      <div className="flex min-w-0 items-start gap-4">
        <Avatar name={character.name} src={character.avatarUrl} size="lg" className="h-16 w-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-[var(--text-primary)]">{character.name}</h3>
              <VisibilityBadge visibility={character.visibility} moderationStatus={character.moderationStatus} />
            </div>
            <Button asChild variant="ghost" size="icon" className="-mr-2 -mt-2 h-10 w-10 shrink-0">
              <Link href={`/character/${character.id}/edit`} aria-label={`Edit ${character.name}`}><Pencil className="h-4 w-4" /></Link>
            </Button>
          </div>
          <p className="mt-3 line-clamp-2 break-words text-xs leading-5 text-[var(--text-secondary)]">{character.description || "No public description yet."}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--codex-rule)] pt-3 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" />{character._count.chats}</span>
        <span className="inline-flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" />{character.likes}</span>
        <span className="inline-flex items-center justify-end gap-1.5"><Clock3 className="h-3.5 w-3.5" />{updatedLabel}</span>
      </div>
    </article>
  );
}

function VisibilityBadge({ visibility, moderationStatus }: Pick<StudioCharacter, "visibility" | "moderationStatus">) {
  const needsReview = visibility === "PUBLIC" && moderationStatus === "PENDING";
  const label = needsReview ? "In review" : visibility === "PUBLIC" ? "Published" : visibility.toLowerCase();
  return (
    <span className={cn("mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] uppercase tracking-[.12em]", visibility === "PUBLIC" && !needsReview ? "border-emerald-400/40 text-emerald-300" : "border-[var(--codex-rule)] text-[var(--text-muted)]")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", visibility === "PUBLIC" && !needsReview ? "bg-emerald-400" : needsReview ? "bg-amber-400" : "bg-[var(--text-muted)]")} />
      {label}
    </span>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border", done ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-[var(--codex-rule)] text-[var(--text-muted)]")}>{done ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span>
      <span className={done ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}>{label}</span>
    </div>
  );
}

function EmptyStudio() {
  return (
    <div className="flex flex-col items-center border border-dashed border-[var(--codex-rule)] px-6 py-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full border border-[var(--codex-rule)] text-[var(--codex-mint)]"><UsersRound className="h-7 w-7" /></span>
      <h3 className="mt-5 text-xl font-semibold text-[var(--text-primary)]">Create your first character</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">Start with a spark or build every detail yourself. You can keep the character private until it is ready.</p>
      <Button asChild className="mt-6"><Link href="/create-character"><Plus className="h-4 w-4" />Create character</Link></Button>
    </div>
  );
}

function StudioSkeleton() {
  return <div className="space-y-6 px-5 py-8 sm:px-0"><div className="skeleton h-36" /><div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton h-28" />)}</div><div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton h-44" />)}</div></div>;
}

function StudioError({ message }: { message: string }) {
  return <div className="mx-5 my-8 flex items-start gap-3 border border-rose-400/30 bg-rose-400/5 p-5 text-sm text-rose-200 sm:mx-0"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-medium">Creator Studio is unavailable</p><p className="mt-1 text-rose-200/75">{message}</p></div></div>;
}
