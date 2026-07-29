import Link from "next/link";
import { ArrowRight, BookOpen, MessageCircle, Route } from "lucide-react";
import { CharacterBentoGrid } from "@/components/characters/CharacterBentoGrid";
import { Button } from "@/components/ui/button";
import { PageShell, Surface } from "@/components/ui/page";
import { DISCOVERY_TAGS } from "@/lib/character-tags";
import { getSeoCharactersForTags } from "@/lib/seo-character-collections";
import { SEO_LANDINGS, type SeoLandingContent } from "@/lib/seo-landing-content";
import { CANONICAL_SITE_ORIGIN } from "@/lib/site-origin";

const highlightIcons = [BookOpen, Route, MessageCircle] as const;

export async function SeoLandingPage({
  content,
  characters: suppliedCharacters
}: {
  content: SeoLandingContent;
  characters?: Awaited<ReturnType<typeof getSeoCharactersForTags>>;
}) {
  const characters = suppliedCharacters
    ?? await getSeoCharactersForTags(content.relatedTags.join(","));
  const relatedTags = content.relatedTags
    .map((slug) => DISCOVERY_TAGS.find((tag) => tag.slug === slug))
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));
  const canonicalUrl = `${CANONICAL_SITE_ORIGIN}${content.path}`;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Nythera",
        item: CANONICAL_SITE_ORIGIN
      },
      {
        "@type": "ListItem",
        position: 2,
        name: content.title,
        item: canonicalUrl
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      <PageShell className="space-y-14 pb-24">
        <header className="grid gap-8 border-b border-[var(--codex-rule)] pb-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)] lg:items-end">
          <div>
            <p className="mb-3 text-[10px] font-medium uppercase tracking-[.3em] text-[var(--codex-violet)]">{content.eyebrow}</p>
            <h1 className="font-editorial max-w-5xl text-[clamp(3.6rem,8vw,7.5rem)] font-medium leading-[.8] tracking-[-.05em] text-[var(--codex-ivory)]">
              {content.title}
            </h1>
          </div>
          <div className="space-y-5 lg:pb-2">
            <p className="font-editorial text-xl italic leading-8 text-[var(--text-secondary)]">{content.description}</p>
            <Button asChild>
              <Link href="/explore">
                Explore all characters
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,.75fr)_minmax(0,1.25fr)]">
          <div>
            <p className="codex-kicker">About this archive</p>
            <h2 className="font-editorial mt-2 text-4xl font-medium text-[var(--codex-ivory)]">Roleplay with a foundation</h2>
          </div>
          <div className="grid gap-5 font-editorial text-xl leading-8 text-[var(--text-secondary)]">
            {content.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </section>

        <section className="grid border-y border-[var(--codex-rule)] md:grid-cols-3">
          {content.highlights.map((highlight, index) => {
            const Icon = highlightIcons[index] ?? BookOpen;
            return (
              <article key={highlight.title} className="border-b border-[var(--codex-rule)] p-6 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 lg:p-8">
                <Icon className="h-5 w-5 text-[var(--codex-mint)]" />
                <h2 className="font-editorial mt-5 text-3xl font-medium text-[var(--codex-ivory)]">{highlight.title}</h2>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{highlight.description}</p>
              </article>
            );
          })}
        </section>

        {relatedTags.length ? (
          <nav aria-label="Related roleplay themes" className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <span className="codex-kicker">Related themes</span>
            {relatedTags.map((tag) => (
              <Link
                key={tag.slug}
                href={`/tags/${tag.slug}`}
                className="focus-ring border-b border-[var(--codex-rule)] pb-1 text-xs uppercase tracking-[.14em] text-[var(--text-secondary)] no-underline hover:border-[var(--codex-mint)] hover:text-[var(--codex-mint)]"
              >
                {tag.label}
              </Link>
            ))}
          </nav>
        ) : null}

        {characters.length ? (
          <CharacterBentoGrid title="Characters to meet" characters={characters} />
        ) : (
          <Surface className="p-8 text-center">
            <h2 className="font-editorial text-3xl text-[var(--codex-ivory)]">The next character is still being written</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
              This public collection is empty right now. Explore the full archive or create a character for this theme.
            </p>
          </Surface>
        )}

        <nav aria-label="Learn about Nythera" className="grid gap-4 border-t border-[var(--codex-rule)] pt-8 md:grid-cols-3">
          {Object.values(SEO_LANDINGS).map((landing) => (
            <Link
              key={landing.path}
              href={landing.path}
              aria-current={landing.path === content.path ? "page" : undefined}
              className="focus-ring group border-b border-[var(--codex-rule)] pb-4 no-underline"
            >
              <span className="codex-kicker">{landing.eyebrow}</span>
              <span className="font-editorial mt-2 flex items-center justify-between gap-4 text-2xl text-[var(--codex-ivory)]">
                {landing.title}
                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </nav>
      </PageShell>
    </>
  );
}
