import Link from "next/link";
import { ArrowRight, Brain, Compass, Heart, KeyRound, MessageCircle, Plus, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageShell, SectionHeader, Surface, SurfaceMuted } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
import { CharacterCard } from "@/components/character/character-card";
import { CharacterAvatar } from "@/components/character/character-avatar";

const featured = [
  {
    id: "demo-mira-of-the-ash-library",
    name: "Mira of the Ash Library",
    description: "A careful fantasy archivist who remembers quests, debts, rumors, and the user's choices across sessions.",
    tags: ["fantasy", "roleplay", "lore"],
    likes: 128,
    ratingAverage: 4.8
  },
  {
    id: "demo-ari-next-door",
    name: "Ari Next Door",
    description: "A warm friend persona focused on casual check-ins, light jokes, and remembering personal details safely.",
    tags: ["friend", "casual", "comfort"],
    likes: 76,
    ratingAverage: 4.5
  },
  {
    id: "demo-voss-habit-coach",
    name: "Voss, Habit Coach",
    description: "A practical accountability coach with direct feedback, weekly planning, and preference-aware encouragement.",
    tags: ["coach", "productivity"],
    likes: 93,
    ratingAverage: 4.6
  },
  {
    id: "demo-mira-of-the-ash-library",
    name: "Mira: Ash Door",
    description: "A darker story fork with memory-backed artifacts, hidden rooms, and unresolved debts.",
    tags: ["mystery", "fantasy", "story"],
    likes: 62,
    ratingAverage: 4.7
  }
];

const categories = ["For You", "Trending", "Romance", "Fantasy", "Anime", "Coach", "Friend", "Roleplay", "Lore"];

const continueItems = [
  {
    href: "/chat/demo-chat-mira",
    name: "Ash Library demo",
    character: "Mira",
    text: "Local proxy fallback is active. Add your own model key for live streaming.",
    time: "now"
  },
  {
    href: "/explore",
    name: "Find a new thread",
    character: "Velora",
    text: "Browse public characters by mood, genre, and conversation style.",
    time: "open"
  }
];

export default function HomePage() {
  return (
    <PageShell className="space-y-7">
      <section className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Surface className="relative isolate overflow-hidden p-5 sm:p-7 lg:p-9">
          <div className="pointer-events-none absolute inset-0 -z-10 hero-gradient opacity-90" />
          <div className="grid min-h-[500px] gap-8 lg:grid-cols-[minmax(0,1.15fr)_360px] lg:items-end">
            <div className="self-center">
              <h1 className="max-w-3xl text-[2.75rem] font-semibold leading-[1.02] tracking-tight text-foreground sm:text-[3.8rem] xl:text-[4.1rem]">
                Meet characters who remember your story.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Explore public personas, create your own, and settle into cozy memory-backed conversations with the model keys you control.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="px-7">
                  <Link href="/explore">
                    Start chatting
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/create-character">
                    <Wand2 className="h-4 w-4" />
                    Create character
                  </Link>
                </Button>
              </div>
              <div className="mt-7 max-w-2xl">
                <SearchBar placeholder="Search a mood, genre, or character..." />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {["slow-burn fantasy", "daily check-in", "anime rival", "soft coach"].map((prompt) => (
                  <Link
                    key={prompt}
                    href="/explore"
                    className="rounded-full border border-white/[0.045] bg-white/[0.028] px-3 py-1.5 text-xs font-medium text-muted-foreground no-underline shadow-inset transition hover:border-primary/20 hover:bg-primary/[0.075] hover:text-foreground"
                  >
                    {prompt}
                  </Link>
                ))}
              </div>
            </div>

            <div className="hidden lg:block">
              <SurfaceMuted className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Tonight&apos;s doorway</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">A first scene ready to continue.</p>
                  </div>
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-5 rounded-[28px] border border-white/[0.055] bg-[#15111f] p-4 shadow-inset">
                  <div className="flex items-center gap-4">
                    <CharacterAvatar name="Mira" size="lg" className="border-primary/[0.18] bg-primary/[0.075]" />
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold">Mira of the Ash Library</p>
                      <p className="mt-1 text-sm text-muted-foreground">Fantasy archivist</p>
                    </div>
                  </div>
                  <p className="mt-5 text-sm leading-7 text-muted-foreground">
                    &ldquo;The ash door remembers your name. Tell me which promise you want to keep first.&rdquo;
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {["lore", "memory", "mystery"].map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>
                </div>
              </SurfaceMuted>
            </div>
          </div>
        </Surface>

        <div className="grid content-start gap-5">
          <Surface className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Continue chatting</h2>
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-4 space-y-3">
              {continueItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-start gap-3 rounded-3xl border border-white/[0.045] bg-white/[0.028] p-3 no-underline shadow-inset transition hover:border-primary/20 hover:bg-primary/[0.075]"
                >
                  <CharacterAvatar name={item.character} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.text}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </Link>
              ))}
            </div>
          </Surface>

          <Surface className="p-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <MiniStat icon={Brain} label="memory" value="pgvector" />
              <MiniStat icon={KeyRound} label="keys" value="BYOK" />
              <MiniStat icon={Compass} label="catalog" value="public" />
            </div>
          </Surface>
        </div>
      </section>

      <Surface className="p-3">
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-fit gap-2">
            {categories.map((category, index) => (
              <Link
                key={category}
                href="/explore"
                className={`rounded-full border px-4 py-2 text-sm font-medium no-underline transition ${
                  index === 0
                    ? "border-primary/25 bg-primary/[0.1] text-[#e5ddff]"
                    : "border-white/[0.045] bg-white/[0.028] text-muted-foreground hover:border-primary/20 hover:bg-primary/[0.075] hover:text-foreground"
                }`}
              >
                {category}
              </Link>
            ))}
          </div>
        </div>
      </Surface>

      <section>
        <SectionHeader
          title="Featured characters"
          description="High-signal personas ready for a first message, memory, and streaming."
          action={
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/explore">
                Explore all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {featured.map((item) => (
            <CharacterCard key={`${item.id}-${item.name}`} character={item} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Info icon={MessageCircle} title="Streaming that feels alive" text="Responses appear as a conversation, not as a delayed wall of text." />
        <Info icon={Brain} title="Memory in the prompt" text="Relevant facts are retrieved into character context before replies." />
        <Info icon={Plus} title="Creator-first tools" text="Build characters, tune style, and test the first scene quickly." />
      </section>
    </PageShell>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Brain; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/[0.045] bg-white/[0.028] p-3 shadow-inset">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <p className="mt-2 text-xs font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Info({ icon: Icon, title, text }: { icon: typeof MessageCircle; title: string; text: string }) {
  return (
    <Surface className="p-5">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="mt-4 text-lg font-semibold leading-6">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </Surface>
  );
}
