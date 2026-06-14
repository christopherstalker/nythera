import Link from "next/link";
import { ArrowRight, Brain, MessageCircle, Plus, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageShell, SectionHeader, Surface, SurfaceMuted } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
import { CharacterAvatar } from "@/components/character/character-avatar";
import { ContinueChatsPanel } from "@/components/chat/continue-chats-panel";
import { FeaturedCharacters } from "@/components/character/featured-characters";

const categories = ["For You", "Trending", "Romance", "Fantasy", "Anime", "Coach", "Friend", "Roleplay", "Lore"];

export default function HomePage() {
  return (
    <PageShell className="space-y-12">
      <section className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Surface className="relative isolate overflow-hidden p-6 sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute inset-0 -z-10 hero-gradient opacity-90" />
          <div className="grid min-h-[470px] gap-10 sm:min-h-[540px] lg:grid-cols-[minmax(0,1.15fr)_360px] lg:items-end">
            <div className="self-center">
              <h1 className="max-w-3xl text-[2.5rem] font-semibold leading-[1.04] tracking-tight text-foreground sm:text-[4rem] xl:text-[4.35rem]">
                Meet characters who remember your story.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Explore public personas, create your own, and settle into cozy conversations that remember what matters.
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
              <div className="mt-8 max-w-2xl">
                <SearchBar placeholder="Search a mood, genre, or character..." />
              </div>
              <div className="mt-6 flex flex-wrap gap-2.5">
                {["slow-burn fantasy", "daily check-in", "anime rival", "soft coach"].map((prompt) => (
                  <Link
                    key={prompt}
                    href="/explore"
                    className="rounded-full border border-white/[0.025] bg-white/[0.024] px-3 py-1.5 text-xs font-medium text-muted-foreground no-underline shadow-inset transition hover:border-primary/[0.14] hover:bg-primary/[0.06] hover:text-foreground"
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
                <div className="mt-5 rounded-[28px] border border-white/[0.025] bg-white/[0.028] p-4 shadow-inset">
                  <div className="flex items-center gap-4">
                    <CharacterAvatar name="Velora" size="lg" className="border-primary/[0.18] bg-primary/[0.075]" />
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold">Your first character</p>
                      <p className="mt-1 text-sm text-muted-foreground">A private persona you shape</p>
                    </div>
                  </div>
                  <p className="mt-5 text-sm leading-7 text-muted-foreground">
                    &ldquo;Set the voice, the opening scene, and the kind of memory this conversation should keep.&rdquo;
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {["private", "memory", "custom"].map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>
                </div>
              </SurfaceMuted>
            </div>
          </div>
        </Surface>

        <div className="grid content-start gap-6">
          <ContinueChatsPanel />
        </div>
      </section>

      <div className="px-1">
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-fit gap-2.5">
            {categories.map((category, index) => (
              <Link
                key={category}
                href="/explore"
                className={`rounded-full border px-4 py-2.5 text-sm font-medium no-underline transition ${
                  index === 0
                    ? "border-primary/[0.18] bg-primary/[0.1] text-foreground shadow-inset"
                    : "border-white/[0.025] bg-white/[0.022] text-muted-foreground hover:border-primary/[0.14] hover:bg-primary/[0.06] hover:text-foreground"
                }`}
              >
                {category}
              </Link>
            ))}
          </div>
        </div>
      </div>

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

        <div className="mt-5">
          <FeaturedCharacters />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Info icon={MessageCircle} title="Streaming that feels alive" text="Responses appear as a conversation, not as a delayed wall of text." />
        <Info icon={Brain} title="Memories that return naturally" text="Important details can come back softly when they make the conversation better." />
        <Info icon={Plus} title="Creator-first tools" text="Build characters, tune style, and test the first scene quickly." />
      </section>
    </PageShell>
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
