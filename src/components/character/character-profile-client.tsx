"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Copy, Edit3, Flag, Globe, Heart, Lock, MessageCircle, Share2, Sparkles, Star, Trash2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveActions } from "@/components/ui/responsive-actions";
import { Badge } from "@/components/ui/badge";
import { CharacterAvatar } from "@/components/character/character-avatar";
import { Avatar } from "@/components/ui/avatar";
import { RichMessageText } from "@/components/chat/rich-message-text";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell, Surface, SurfaceMuted } from "@/components/ui/page";
import { cn } from "@/lib/utils";
import { displayTagLabel } from "@/lib/character-tags";
import type { PublicCharacterProfile } from "@/types";

export default function CharacterProfileClient({
  initialCharacter
}: {
  initialCharacter: PublicCharacterProfile | null;
}) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [character, setCharacter] = useState<PublicCharacterProfile | null>(initialCharacter);
  const [recentChat, setRecentChat] = useState<{ id: string } | null>(null);
  const [viewer, setViewer] = useState<{ canEdit: boolean; liked: boolean; rating?: { value: number; review?: string | null } | null }>({
    canEdit: false,
    liked: false,
    rating: null
  });
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Policy or safety issue");
  const [reportDetails, setReportDetails] = useState("");
  const [ratingValue, setRatingValue] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviews, setReviews] = useState<Array<{ value: number; review?: string | null; user?: { username?: string | null } | null }>>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function loadCharacter() {
      try {
        const response = await fetch(`/api/characters/${params.id}`);
        if (!response.ok) {
          setError("Character not found or unavailable.");
          return;
        }

        const body = await response.json();
        setCharacter(body.character);
        setRecentChat(body.recentChat ?? null);
        setViewer(body.viewer ?? { canEdit: false, liked: false, rating: null });
        setLiked(Boolean(body.viewer?.liked));
        setRatingValue(Number(body.viewer?.rating?.value ?? 0));
        setReviewText(body.viewer?.rating?.review ?? "");
      } catch {
        setError("Character not found or unavailable.");
      }
    }

    void loadCharacter();
  }, [params.id]);

  useEffect(() => {
    async function loadReviews() {
      try {
        const response = await fetch(`/api/characters/${params.id}/rating`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const body = await response.json();
        setReviews(Array.isArray(body?.reviews) ? body.reviews : []);
      } catch {}
    }

    void loadReviews();
  }, [params.id, viewer.rating]);

  const styleEntries = useMemo(() => {
    if (!character?.communicationStyle) {
      return [];
    }

    return Object.entries(character.communicationStyle)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .slice(0, 7);
  }, [character]);
  const loreEntries = useMemo(() => {
    return Array.isArray(character?.lorebook?.entries)
      ? character.lorebook.entries.filter((entry) => entry.text?.trim()).slice(0, 8)
      : [];
  }, [character]);
  const heroStyle = character?.visualIdentity?.accentColor
    ? {
        borderColor: character.visualIdentity.accentColor
      }
    : undefined;

  async function updateVisibility(nextVisibility: "PRIVATE" | "PUBLIC" | "UNLISTED") {
    if (!character) {
      return;
    }

    if (nextVisibility === "PUBLIC" && !character.avatarUrl?.trim()) {
      setStatus("Add an avatar before publishing publicly.");
      return;
    }

    setVisibilitySaving(true);
    setStatus(null);
    const response = await fetch(`/api/characters/${character.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visibility: nextVisibility })
    });
    setVisibilitySaving(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setStatus(body?.error ?? "Could not update visibility.");
      return;
    }

    const body = await response.json();
    setCharacter(body.character);
    setStatus(nextVisibility === "PUBLIC" ? "Character is now public in Explore." : "Character is now private.");
    window.dispatchEvent(new CustomEvent("nythera:characters-updated"));
  }

  async function startChat() {
    if (!character) {
      return;
    }

    if (recentChat) {
      router.push(`/chat/${recentChat.id}`);
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
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Could not start chat.");
      return;
    }

    const body = await response.json();
    router.push(`/chat/${body.chat.id}`);
  }

  async function cloneCharacter() {
    const response = await fetch(`/api/characters/${params.id}`, { method: "POST" });
    if (response.status === 401) {
      router.push("/login");
      return;
    }
    if (response.ok) {
      const body = await response.json();
      router.push(`/character/${body.character.id}`);
    }
  }

  async function likeCharacter() {
    const response = await fetch(`/api/characters/${params.id}/like`, { method: "POST" });
    if (response.status === 401) {
      router.push("/login");
      return;
    }
    if (response.ok) {
      const body = await response.json();
      setLiked(Boolean(body.liked));
      setCharacter((current) =>
        current ? { ...current, likes: Math.max(0, current.likes + (body.liked ? 1 : -1)) } : current
      );
    }
  }

  async function shareCharacter() {
    if (!character) {
      return;
    }

    const url = `${window.location.origin}/character/${character.id}`;
    if (navigator.share) {
      await navigator.share({ title: character.name, text: character.description, url }).catch(() => undefined);
    } else {
      await navigator.clipboard?.writeText(url);
      setStatus("Character link copied.");
    }
  }

  async function reportCharacter() {
    const response = await fetch(`/api/characters/${params.id}/report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: reportReason, details: reportDetails })
    });

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (response.ok) {
      setReportOpen(false);
      setReportDetails("");
      setStatus("Report submitted.");
      return;
    }

    const body = await response.json().catch(() => null);
    setStatus(body?.error ?? "Could not submit report.");
  }

  async function deleteCharacter() {
    if (!character || deleting) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${character.name}" forever? This removes the bot, its chats, likes, ratings, reports, and memories. This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setStatus(null);
    const response = await fetch(`/api/characters/${character.id}`, { method: "DELETE" });
    setDeleting(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setStatus(body?.error ?? "Could not delete character.");
      return;
    }

    window.dispatchEvent(new CustomEvent("nythera:characters-updated"));
    router.replace("/library");
  }

  async function submitRating() {
    if (!ratingValue) {
      setStatus("Choose a rating first.");
      return;
    }

    const response = await fetch(`/api/characters/${params.id}/rating`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: ratingValue, review: reviewText })
    });

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setStatus(body?.error ?? "Could not save rating.");
      return;
    }

    const body = await response.json();
    setCharacter((current) =>
      current
        ? {
            ...current,
            ratingAverage: body.rating.average,
            ratingCount: body.rating.count
          }
        : current
    );
    setViewer((current) => ({ ...current, rating: { value: ratingValue, review: reviewText } }));
    setStatus("Rating saved.");
  }

  if (error) {
    return (
      <PageShell>
        <EmptyState icon={Flag} title="Character unavailable" description={error} />
      </PageShell>
    );
  }

  if (!character) {
    return (
      <PageShell>
        <div className="skeleton h-[520px] rounded-[30px]" />
      </PageShell>
    );
  }

  return (
    <PageShell className="codex-character-page">
      <div className="grid overflow-hidden border-y border-[var(--codex-rule)] lg:grid-cols-[minmax(300px,.72fr)_minmax(0,1.5fr)]">
        <aside className="relative border-b border-[var(--codex-rule)] bg-[var(--codex-paper-raised)] lg:border-b-0 lg:border-r">
          <div className="relative min-h-[440px] overflow-hidden sm:min-h-[560px] lg:min-h-[620px]">
            <Avatar name={character.name} src={character.avatarUrl} size="xl" className="absolute inset-0 h-full w-full rounded-none border-0" imageClassName="object-cover object-top" />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--codex-paper-raised)] via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <p className="mb-2 text-[10px] uppercase tracking-[.26em] text-[var(--codex-mint)]">Character dossier</p>
              <h1 className="font-editorial text-[clamp(4rem,10vw,7.5rem)] font-medium leading-[.72] tracking-[-.05em] text-[var(--codex-ivory)]">{character.name}</h1>
              <p className="mt-5 flex items-center gap-2 text-xs uppercase tracking-[.16em] text-muted-foreground">
                <User className="h-3.5 w-3.5" /> by @{character.creator?.username ?? "user"}
              </p>
            </div>
          </div>

          <div className="space-y-6 p-6 sm:p-8">
            <p className="font-editorial text-xl leading-8 text-[var(--codex-ivory)]"><RichMessageText text={character.description} /></p>
            <div className="flex flex-wrap gap-2">
              {character.tags.map((tag) => (
                <Link key={tag} href={`/tags/${tag}`} className="focus-ring rounded-full no-underline">
                  <Badge>{displayTagLabel(tag)}</Badge>
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-3 border-y border-[var(--codex-rule)] py-4 text-center">
              <Stat icon={MessageCircle} value="Live" label="chat-ready" />
              <Stat icon={Heart} value={String(character.likes)} label="likes" rose />
              <Stat icon={Star} value={(character.ratingAverage || 0).toFixed(1)} label={`${character.ratingCount || 0} ratings`} />
            </div>

            <div className="grid gap-2">
              {viewer.canEdit ? (
                <>
                  <Button asChild variant="outline">
                    <Link href={`/character/${character.id}/edit`}>
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                  <div className="grid grid-cols-2 gap-1 border border-[var(--codex-rule)] p-1">
                    <Button
                      type="button"
                      variant={character.visibility === "PRIVATE" ? "primary" : "outline"}
                      size="sm"
                      disabled={visibilitySaving}
                      onClick={() => void updateVisibility("PRIVATE")}
                    >
                      <Lock className="h-4 w-4" />
                      Private
                    </Button>
                    <Button
                      type="button"
                      variant={character.visibility === "PUBLIC" ? "primary" : "outline"}
                      size="sm"
                      disabled={visibilitySaving}
                      onClick={() => void updateVisibility("PUBLIC")}
                    >
                      <Globe className="h-4 w-4" />
                      Public
                    </Button>
                  </div>
                </>
              ) : null}
              <Button onClick={startChat} size="lg" className="w-full px-7">
                <MessageCircle className="h-4 w-4" />
                {recentChat ? "Continue chat" : "Start chat"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn(liked && "border-[oklch(var(--color-danger)/.4)] text-[oklch(var(--color-danger))]")}
                onClick={likeCharacter}
              >
                <Heart className={cn("h-4 w-4", liked && "fill-current")} />
                Like
              </Button>
              <Button type="button" variant="outline" onClick={shareCharacter}>
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </div>
        </aside>

        <main className="space-y-10 p-6 sm:p-10 lg:p-12 xl:p-16">
          <header className="border-b border-[var(--codex-rule)] pb-7">
            <p className="mb-2 text-[10px] uppercase tracking-[.28em] text-[var(--codex-violet)]">Persona manuscript</p>
            <h2 className="font-editorial text-5xl font-medium leading-none text-[var(--codex-ivory)] sm:text-6xl">Inside the character</h2>
          </header>

          <div className="space-y-8">
            <ProfileSection title="Personality">{character.personality}</ProfileSection>
            {character.persona ? (
              <ProfileSection title="Persona engine">
                {[
                  character.persona.role ? `Role: ${character.persona.role}` : null,
                  character.persona.emotionalTone ? `Emotional tone: ${character.persona.emotionalTone}` : null,
                  character.persona.relationshipStyle ? `Relationship: ${character.persona.relationshipStyle}` : null,
                  character.persona.speakingStyle ? `Speaking style: ${character.persona.speakingStyle}` : null
                ]
                  .filter(Boolean)
                  .join("\n")}
              </ProfileSection>
            ) : null}
            {character.scenario ? <ProfileSection title="Scenario">{character.scenario}</ProfileSection> : null}
            <ProfileSection title="Greeting">
              <span className="font-editorial block border-l border-[var(--codex-mint)] pl-5 text-2xl italic leading-9 text-[var(--codex-ivory)]"><RichMessageText text={character.greeting} /></span>
            </ProfileSection>
            <ProfileSection title="Memory and lore">
              {loreEntries.length
                ? loreEntries.map((entry) => `${entry.keywords?.join(", ") || "Lore"}: ${entry.text}`).join("\n\n")
                : character.scenario
                  ? "This persona is configured with a scene foundation and can retrieve relevant saved memories during chat."
                  : "No extra lore notes are available yet."}
            </ProfileSection>
          </div>

          <div className="grid gap-8 border-t border-[var(--codex-rule)] pt-9 xl:grid-cols-2">
            <section>
              <h2 className="font-editorial text-3xl font-medium leading-6 text-[var(--codex-ivory)]">Communication style</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {styleEntries.length > 0 ? (
                  styleEntries.map(([key, value]) => (
                    <span key={key} className="violet-pill">
                      {formatKey(key)}: {String(value)}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No style settings yet.</span>
                )}
              </div>
            </section>

            <section>
              <h2 className="font-editorial text-3xl font-medium leading-6 text-[var(--codex-ivory)]">Creator actions</h2>
              <div className="mt-4 grid gap-2">
                <Button type="button" variant="outline" onClick={cloneCharacter}>
                  <Copy className="h-4 w-4" />
                  Clone character
                </Button>
                <Button type="button" variant="outline" onClick={shareCharacter}>
                  <Share2 className="h-4 w-4" />
                  Copy public link
                </Button>
                {viewer.canEdit ? (
                  <Button type="button" variant="destructive" onClick={deleteCharacter} disabled={deleting}>
                    <Trash2 className="h-4 w-4" />
                    {deleting ? "Deleting..." : "Delete forever"}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={() => setReportOpen(true)}>
                  <Flag className="h-4 w-4 text-destructive" />
                  Report
                </Button>
              </div>
            </section>
          </div>

          <RatingPanel value={ratingValue} review={reviewText} onValueChange={setRatingValue} onReviewChange={setReviewText} onSubmit={submitRating} />
          <ReviewsPanel reviews={reviews} />
        </main>
      </div>
      {status ? <p className="mt-4 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-secondary)]">{status}</p> : null}
      {reportOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/82 p-4">
          <div className="glass-panel w-full max-w-md p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Report character</h2>
              <button type="button" onClick={() => setReportOpen(false)} className="focus-ring grid h-9 w-9 place-items-center rounded-2xl text-[var(--text-secondary)] hover:bg-white/[0.055]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-[var(--text-primary)]">Reason</span>
              <input value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="focus-ring glass-input mt-2 h-11 w-full rounded-[var(--radius-md)] px-3 text-sm focus:border-[var(--accent-purple)]" />
            </label>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-[var(--text-primary)]">Details</span>
              <textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} className="focus-ring glass-input mt-2 min-h-28 w-full rounded-[var(--radius-md)] px-3 py-2 text-sm focus:border-[var(--accent-purple)]" />
            </label>
            <ResponsiveActions className="mt-5" align="end">
              <Button type="button" variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
              <Button type="button" variant="destructive" onClick={reportCharacter}>Submit report</Button>
            </ResponsiveActions>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-[var(--codex-rule)] pb-8 md:grid-cols-[180px_minmax(0,1fr)]">
      <h2 className="text-[10px] font-semibold uppercase tracking-[.24em] text-[var(--codex-violet)]">{title}</h2>
      <p className="font-editorial whitespace-pre-wrap text-xl leading-8 text-[var(--codex-ivory)] md:text-2xl md:leading-9">{children}</p>
    </section>
  );
}

function RatingPanel({
  value,
  review,
  onValueChange,
  onReviewChange,
  onSubmit
}: {
  value: number;
  review: string;
  onValueChange: (value: number) => void;
  onReviewChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <SurfaceMuted className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold leading-6">Rate this character</h2>
          <p className="mt-1 text-sm text-muted-foreground">Help other roleplayers find consistent personas.</p>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} type="button" onClick={() => onValueChange(star)} className="focus-ring rounded-md p-1 text-[#f2c572]">
              <Star className={cn("h-6 w-6", value >= star && "fill-[#f2c572]")} />
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={review}
        onChange={(event) => onReviewChange(event.target.value)}
        placeholder="Optional review..."
        className="focus-ring glass-input mt-4 min-h-24 w-full rounded-[var(--radius-md)] px-3 py-2 text-sm focus:border-[var(--accent-purple)]"
      />
      <Button type="button" className="mt-3" onClick={onSubmit}>
        Save rating
      </Button>
    </SurfaceMuted>
  );
}

function ReviewsPanel({ reviews }: { reviews: Array<{ value: number; review?: string | null; user?: { username?: string | null } | null }> }) {
  if (reviews.length === 0) {
    return null;
  }

  return (
    <SurfaceMuted className="p-5">
      <h2 className="text-lg font-semibold leading-6">Recent reviews</h2>
      <div className="mt-4 grid gap-3">
        {reviews.map((review, index) => (
          <div key={index} className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] p-3 shadow-[var(--glass-highlight)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-[var(--text-primary)]">@{review.user?.username ?? "user"}</p>
              <p className="text-xs text-[#f2c572]">{review.value}/5</p>
            </div>
            {review.review ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">{review.review}</p> : null}
          </div>
        ))}
      </div>
    </SurfaceMuted>
  );
}

function Stat({ icon: Icon, value, label, rose = false }: { icon: typeof MessageCircle; value: string; label: string; rose?: boolean }) {
  return (
    <SurfaceMuted className="flex items-center gap-3 p-4">
      <Icon className={cn("h-5 w-5", rose ? "text-[#f0a8c8]" : "text-primary")} />
      <div>
        <p className="font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </SurfaceMuted>
  );
}

function formatKey(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}
