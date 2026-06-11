import Link from "next/link";
import { ArrowRight, Brain, Compass, Heart, KeyRound, MessageCircle, Plus, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const featured = [
  {
    id: "demo-mira-of-the-ash-library",
    name: "Mira of the Ash Library",
    tag: "fantasy",
    tone: "Continuity-heavy fantasy archivist who remembers quests, promises, and lore.",
    likes: "12.8k",
    chats: "42k",
    gradient: "from-primary/90 via-primary/35 to-destructive/35"
  },
  {
    id: "demo-ari-next-door",
    name: "Ari Next Door",
    tag: "friend",
    tone: "Warm nightly check-ins, small jokes, and safe emotional continuity.",
    likes: "9.4k",
    chats: "31k",
    gradient: "from-primary/75 via-primary/25 to-[#161616]"
  },
  {
    id: "demo-voss-habit-coach",
    name: "Voss, Habit Coach",
    tag: "coach",
    tone: "Direct planning, practical accountability, and low-friction next actions.",
    likes: "7.1k",
    chats: "18k",
    gradient: "from-destructive/80 via-primary/35 to-[#161616]"
  },
  {
    id: "demo-mira-of-the-ash-library",
    name: "Mira: Ash Door",
    tag: "roleplay",
    tone: "A darker story fork with memory-backed artifacts and unresolved debts.",
    likes: "6.2k",
    chats: "15k",
    gradient: "from-primary/60 via-[#232033] to-[#161616]"
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
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="container space-y-6 py-6">
        <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative overflow-hidden rounded-[28px] border border-border bg-card p-5 shadow-card-glow sm:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_20%,rgba(139,92,246,0.18),transparent_24rem),linear-gradient(135deg,rgba(139,92,246,0.12),rgba(239,68,68,0.06)_48%,transparent_72%)]" />
            <div className="relative max-w-4xl 2xl:max-w-[720px]">
              <div className="flex flex-wrap items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="text-character text-xs font-semibold uppercase">Free BYOK character chat</span>
              </div>
              <h1 className="mt-4 max-w-3xl text-[38px] font-bold leading-[1.05] tracking-tight text-foreground sm:text-[48px]">
                Your Characters.
                <br />
                Your World.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                Start roleplay, companion chats, and memory-backed stories from one clean workspace. Add your own provider key when you want live models.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-xl px-7">
                  <Link href="/explore">
                    Start Chatting
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-xl">
                  <Link href="/create-character">
                    <Wand2 className="h-4 w-4" />
                    Create Character
                  </Link>
                </Button>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {["slow-burn fantasy", "daily check-in", "anime rival", "soft coach"].map((prompt) => (
                  <Link
                    key={prompt}
                    href="/explore"
                    className="rounded-full border border-border bg-background/55 px-3 py-1.5 text-xs font-medium text-muted-foreground no-underline transition hover:border-primary/45 hover:bg-primary/10 hover:text-primary"
                  >
                    {prompt}
                  </Link>
                ))}
              </div>
            </div>
            <div className="absolute bottom-6 right-6 top-6 hidden w-[420px] flex-col justify-between rounded-[24px] border border-border bg-background/55 p-4 2xl:flex">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Spotlight worlds</p>
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Start from a mood, then fork the character when the story clicks.</p>
              </div>
              <div className="space-y-2">
                {[
                  ["The silver door", "Fantasy mystery with persistent artifacts"],
                  ["Night balcony", "Soft companion chat with gentle memory"],
                  ["First action", "Coach persona for focused daily planning"]
                ].map(([title, text]) => (
                  <Link
                    key={title}
                    href="/explore"
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 no-underline transition hover:border-primary/45 hover:bg-primary/10"
                  >
                    <div className="h-10 w-10 shrink-0 rounded-full border border-primary bg-primary/10" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                      <p className="truncate text-xs text-muted-foreground">{text}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <aside className="grid gap-4">
            <section className="rounded-[24px] border border-border bg-card p-5 shadow-card-glow">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Continue chatting</h2>
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-4 space-y-2">
                {continueItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-background/55 p-3 no-underline transition hover:border-primary/45 hover:bg-primary/10"
                  >
                    <Avatar name={item.character} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.text}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{item.time}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-border bg-card p-5 shadow-card-glow">
              <div className="grid grid-cols-3 gap-3 text-center">
                <MiniStat icon={Brain} label="memory" value="pgvector" />
                <MiniStat icon={KeyRound} label="keys" value="BYOK" />
                <MiniStat icon={Compass} label="public" value="catalog" />
              </div>
            </section>
          </aside>
        </section>

        <section className="rounded-[28px] border border-border bg-card p-4 shadow-card-glow">
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-fit gap-2">
              {categories.map((category, index) => (
                <Link
                  key={category}
                  href="/explore"
                  className={`rounded-full px-4 py-2 text-sm font-medium no-underline transition ${
                    index === 0 ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                  }`}
                >
                  {category}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold leading-8">Featured characters</h2>
              <p className="mt-1 text-sm text-muted-foreground">High-signal personas ready for first message, memory, and streaming.</p>
            </div>
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/explore">
                Explore all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {featured.map((item) => (
              <Link
                key={`${item.id}-${item.name}`}
                href={`/character/${item.id}`}
                className="group flex min-h-[260px] flex-col overflow-hidden rounded-[24px] border border-border bg-card no-underline shadow-card-glow transition duration-200 hover:-translate-y-1 hover:border-primary/45 hover:shadow-violet-hover"
              >
                <div className={`relative h-24 bg-gradient-to-br ${item.gradient}`}>
                  <div className="absolute -bottom-9 left-5 grid h-[72px] w-[72px] place-items-center rounded-full border-2 border-primary bg-[#161616] text-2xl font-bold text-primary shadow-card-glow">
                    {item.name[0]}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5 pt-11">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-character truncate text-base font-semibold text-foreground">{item.name}</h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.tone}</p>
                    </div>
                    <Badge>{item.tag}</Badge>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-5 text-sm">
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                      <Heart className="h-4 w-4 fill-destructive text-destructive" />
                      {item.likes}
                    </span>
                    <span className="text-muted-foreground">{item.chats} chats</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Info icon={MessageCircle} title="Streaming that feels alive" text="Responses appear as a conversation, not as a delayed wall of text." />
          <Info icon={Brain} title="Memory in the prompt" text="Relevant facts are retrieved into character context before replies." />
          <Info icon={Plus} title="Creator-first tools" text="Build characters, tune style, and test the first scene quickly." />
        </section>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-primary bg-primary/10 text-sm font-bold text-primary">
      {name[0]}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Brain; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/55 p-3">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <p className="mt-2 text-xs font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Info({ icon: Icon, title, text }: { icon: typeof MessageCircle; title: string; text: string }) {
  return (
    <div className="rounded-[24px] border border-border bg-card p-5 shadow-card-glow">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="mt-4 text-lg font-semibold leading-6">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}
