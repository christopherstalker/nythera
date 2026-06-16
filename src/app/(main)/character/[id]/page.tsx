"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Edit3, Flag, Globe, Heart, Lock, MessageCircle, Share2, Sparkles, Star, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CharacterAvatar } from "@/components/character/character-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell, Surface, SurfaceMuted } from "@/components/ui/page";
import { cn } from "@/lib/utils";
import type { CharacterPersona } from "@/types";

type Character = {
  id: string;
  creatorId: string;
  name: string;
  avatarUrl?: string | null;
  description: string;
  personality: string;
  scenario?: string | null;
  greeting: string;
  tags: string[];
  likes: number;
  ratingAverage: number;
  ratingCount: number;
  isNSFW?: boolean;
  visibility?: string;
  communicationStyle?: Record<string, unknown> | null;
  persona?: CharacterPersona | null;
  creator?: {
    username?: string | null;
  } | null;
};

export default function CharacterPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [character, setCharacter] = useState<Character | null>(null);
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

  useEffect(() => {
    fetch(`/api/characters/${params.id}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then((body) => {
        setCharacter(body.character);
        setViewer(body.viewer ?? { canEdit: false, liked: false, rating: null });
        setLiked(Boolean(body.viewer?.liked));
        setRatingValue(Number(body.viewer?.rating?.value ?? 0));
        setReviewText(body.viewer?.rating?.review ?? "");
      })
      .catch(() => setError("Character not found or unavailable."));
  }, [params.id]);

  useEffect(() => {
    fetch(`/api/characters/${params.id}/rating`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => setReviews(Array.isArray(body?.reviews) ? body.reviews : []))
      .catch(() => undefined);
  }, [params.id, viewer.rating]);

  const styleEntries = useMemo(() => {
    if (!character?.communicationStyle) {
      return [];
    }

    return Object.entries(character.communicationStyle)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .slice(0, 7);
  }, [character]);

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
    <PageShell>
      <Surface className="overflow-hidden">
        <div className="relative isolate px-6 py-9 sm:px-9 sm:py-11">
          <div className="pointer-events-none absolute inset-0 -z-10 hero-gradient opacity-90" />
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
              <CharacterAvatar name={character.name} avatarUrl={character.avatarUrl} size="xl" className="h-32 w-32 border-2 border-white/[0.045] shadow-violet-hover" />
              <div className="min-w-0">
                <h1 className="max-w-3xl text-[2.3rem] font-semibold leading-tight tracking-tight text-white sm:text-[3.3rem]">
                  {character.name}
                </h1>
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  by @{character.creator?.username ?? "user"}
                </p>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{character.description}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {character.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {viewer.canEdit ? (
                <>
                  <Button asChild variant="outline" size="lg">
                    <Link href={`/character/${character.id}/edit`}>
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                  <div className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.03] p-1">
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
              <Button onClick={startChat} size="lg" className="px-7">
                <MessageCircle className="h-4 w-4" />
                Start chat
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className={cn(liked && "border-[#f0a8c8]/40 bg-[#f0a8c8]/10 text-[#ffd5e5]")}
                onClick={likeCharacter}
              >
                <Heart className={cn("h-4 w-4 text-[#f0a8c8]", liked && "fill-[#f0a8c8]")} />
                Like
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={shareCharacter}>
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat icon={MessageCircle} value="Live" label="chat-ready" />
              <Stat icon={Heart} value={String(character.likes)} label="likes" rose />
              <Stat icon={Star} value={(character.ratingAverage || 0).toFixed(1)} label={`${character.ratingCount || 0} ratings`} />
            </div>
            <RatingPanel value={ratingValue} review={reviewText} onValueChange={setRatingValue} onReviewChange={setReviewText} onSubmit={submitRating} />
            <ReviewsPanel reviews={reviews} />

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
              <span className="block rounded-[24px] bg-primary/[0.065] px-4 py-3 text-foreground/90 shadow-inset">{character.greeting}</span>
            </ProfileSection>
            <ProfileSection title="Memory and lore">
              {character.scenario ? "This persona is configured with a scene foundation and can retrieve relevant saved memories during chat." : "No extra lore notes are available yet."}
            </ProfileSection>
          </main>

          <aside className="space-y-5">
            <SurfaceMuted className="p-5">
              <h2 className="text-lg font-semibold leading-6">Communication style</h2>
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
            </SurfaceMuted>

            <SurfaceMuted className="p-5">
              <h2 className="text-lg font-semibold leading-6">Creator actions</h2>
              <div className="mt-4 grid gap-2">
                <Button type="button" variant="outline" onClick={cloneCharacter}>
                  <Copy className="h-4 w-4" />
                  Clone character
                </Button>
                <Button type="button" variant="outline" onClick={shareCharacter}>
                  <Share2 className="h-4 w-4" />
                  Copy public link
                </Button>
                <Button type="button" variant="outline" onClick={() => setReportOpen(true)}>
                  <Flag className="h-4 w-4 text-destructive" />
                  Report
                </Button>
              </div>
            </SurfaceMuted>

            <SurfaceMuted className="p-5">
              <Sparkles className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Long-term memory can retrieve relevant user facts into the character prompt before replies.
              </p>
            </SurfaceMuted>
          </aside>
        </div>
      </Surface>
      {status ? <p className="mt-4 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-secondary)] shadow-[var(--glass-highlight)] backdrop-blur-xl">{status}</p> : null}
      {reportOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
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
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
              <Button type="button" variant="destructive" onClick={reportCharacter}>Submit report</Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SurfaceMuted className="p-6">
      <h2 className="text-lg font-semibold leading-6">{title}</h2>
      <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-muted-foreground">{children}</p>
    </SurfaceMuted>
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
