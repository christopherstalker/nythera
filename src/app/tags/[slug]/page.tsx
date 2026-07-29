import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoLandingPage } from "@/components/seo/seo-landing-page";
import { DISCOVERY_TAGS } from "@/lib/character-tags";
import { getSeoCharactersForTags } from "@/lib/seo-character-collections";
import { createLandingMetadata, createTagLandingContent } from "@/lib/seo-landing-content";

type TagPageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 60;

export function generateStaticParams() {
  return DISCOVERY_TAGS.map((tag) => ({ slug: tag.slug }));
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const tag = findTag((await params).slug);
  if (!tag) {
    return {
      title: "Roleplay theme unavailable",
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const content = createTagLandingContent(tag);
  const characters = await getSeoCharactersForTags(tag.slug);
  return {
    ...createLandingMetadata(content),
    robots: characters.length
      ? undefined
      : {
          index: false,
          follow: true
        }
  };
}

export default async function TagPage({ params }: TagPageProps) {
  const tag = findTag((await params).slug);
  if (!tag) {
    notFound();
  }

  const content = createTagLandingContent(tag);
  const characters = await getSeoCharactersForTags(tag.slug);
  return <SeoLandingPage content={content} characters={characters} />;
}

function findTag(slug: string) {
  return DISCOVERY_TAGS.find((tag) => tag.slug === slug);
}
