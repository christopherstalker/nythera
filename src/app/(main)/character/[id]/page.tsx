import type { Metadata } from "next";
import CharacterProfileClient from "@/components/character/character-profile-client";
import { auth } from "@/lib/auth";
import { richTextToPlainText } from "@/lib/rich-text-formatting";
import { getCharacterProfileForViewer } from "@/lib/public-character-profile";
import { CANONICAL_SITE_ORIGIN } from "@/lib/site-origin";

type CharacterPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: CharacterPageProps): Promise<Metadata> {
  const [{ id }, session] = await Promise.all([params, auth()]);
  const character = await getCharacterProfileForViewer(id, session?.user?.id);

  if (!character) {
    return {
      title: "Character unavailable",
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const description = createDescription(character.description);
  const canonicalPath = `/character/${character.id}`;
  const isPublic = character.visibility === "PUBLIC";

  if (!isPublic) {
    return {
      title: character.name,
      description,
      robots: {
        index: false,
        follow: false
      }
    };
  }

  return {
    title: `${character.name} — AI roleplay character`,
    description,
    alternates: {
      canonical: canonicalPath
    },
    openGraph: {
      type: "website",
      url: canonicalPath,
      title: `${character.name} — AI roleplay character | Nythera`,
      description,
      images: character.avatarUrl
        ? [
            {
              url: character.avatarUrl,
              alt: character.name
            }
          ]
        : undefined
    },
    twitter: {
      card: "summary_large_image",
      title: `${character.name} — AI roleplay character | Nythera`,
      description,
      images: character.avatarUrl ? [character.avatarUrl] : undefined
    }
  };
}

export default async function CharacterPage({ params }: CharacterPageProps) {
  const [{ id }, session] = await Promise.all([params, auth()]);
  const character = await getCharacterProfileForViewer(id, session?.user?.id);
  const canonicalUrl = character?.visibility === "PUBLIC" ? `${CANONICAL_SITE_ORIGIN}/character/${character.id}` : null;
  const jsonLd = character && canonicalUrl
    ? {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "@id": canonicalUrl,
        url: canonicalUrl,
        name: `${character.name} — AI roleplay character`,
        description: createDescription(character.description),
        mainEntity: {
          "@type": "Person",
          name: character.name,
          description: createDescription(character.description),
          image: character.avatarUrl || undefined,
          url: canonicalUrl
        },
        isPartOf: {
          "@id": `${CANONICAL_SITE_ORIGIN}/#website`
        }
      }
    : null;

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      ) : null}
      <CharacterProfileClient initialCharacter={character} />
    </>
  );
}

function createDescription(value: string) {
  const plainText = richTextToPlainText(value).replace(/\s+/g, " ").trim();
  return plainText.length > 155 ? `${plainText.slice(0, 152).trimEnd()}…` : plainText;
}
