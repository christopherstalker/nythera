import type { Metadata } from "next";
import type { DiscoveryTag } from "@/lib/character-tags";

export type SeoLandingContent = {
  path: string;
  eyebrow: string;
  title: string;
  description: string;
  intro: string[];
  highlights: Array<{
    title: string;
    description: string;
  }>;
  relatedTags: string[];
};

export const SEO_LANDINGS = {
  aiRoleplay: {
    path: "/ai-roleplay",
    eyebrow: "Interactive fiction, shaped together",
    title: "AI roleplay that keeps the story moving",
    description: "Build immersive AI roleplay stories with expressive characters, persistent persona, memory, and continuity across every scene.",
    intro: [
      "Nythera turns character chat into an evolving roleplay story. Choose a public character or create your own, establish the scene, and guide the narrative through dialogue and action.",
      "Characters can retain persona details, retrieve relevant memories, and continue from the context of the current story instead of treating every message like a disconnected prompt."
    ],
    highlights: [
      {
        title: "Persistent persona",
        description: "Character voice, motivations, relationship style, and behavioral rules stay part of the roleplay foundation."
      },
      {
        title: "Story continuity",
        description: "Scenes, memories, canon, and active narrative threads provide context for longer-running stories."
      },
      {
        title: "Your direction",
        description: "Start with an existing character, remix one into a private copy, or build a custom roleplay persona."
      }
    ],
    relatedTags: ["fantasy", "romance", "adventure", "rpg", "sci-fi", "mystery-noir"]
  },
  aiCharacterChat: {
    path: "/ai-character-chat",
    eyebrow: "Conversation with character",
    title: "AI character chat with persona and memory",
    description: "Chat with AI characters designed for expressive dialogue, consistent personality, relationship dynamics, and story-aware memory.",
    intro: [
      "A memorable AI character needs more than a name and avatar. Nythera character profiles combine personality, speaking style, scenario, greeting, relationship dynamics, and optional lore.",
      "Public profiles let you understand a character before starting. Once the conversation begins, the character uses its persona and the active story context to respond in a more consistent voice."
    ],
    highlights: [
      {
        title: "Know who you are meeting",
        description: "Public profiles surface the character premise, personality, scenario, opening message, ratings, and creator."
      },
      {
        title: "Conversation that develops",
        description: "Relevant context and memories help relationships and recurring details carry forward."
      },
      {
        title: "Private creative control",
        description: "Create a private persona or remix a public character before shaping your own version of the story."
      }
    ],
    relatedTags: ["companion", "friendship", "mentor", "villain", "slow-burn", "wholesome"]
  },
  roleplayCharacters: {
    path: "/roleplay-characters",
    eyebrow: "The living character archive",
    title: "Discover AI roleplay characters",
    description: "Browse public AI roleplay characters for fantasy, romance, sci-fi, horror, mystery, slice-of-life, and more.",
    intro: [
      "Explore Nythera's public character archive by genre, tone, relationship, setting, or role. Every profile introduces the character and the scene before you decide to begin a chat.",
      "Use theme pages to narrow the archive, then open a character dossier to review personality, scenario, greeting, community ratings, and available lore."
    ],
    highlights: [
      {
        title: "Browse by theme",
        description: "Move from broad genres into specific tones, settings, relationships, and character roles."
      },
      {
        title: "Read before you start",
        description: "Character dossiers make the premise and roleplay style visible before the first message."
      },
      {
        title: "Community-created worlds",
        description: "The public archive grows through characters created and published by Nythera users."
      }
    ],
    relatedTags: ["anime", "fantasy", "romance", "cyberpunk", "urban-fantasy", "horror"]
  }
} satisfies Record<string, SeoLandingContent>;

export function createLandingMetadata(content: SeoLandingContent): Metadata {
  return {
    title: content.title,
    description: content.description,
    alternates: {
      canonical: content.path
    },
    openGraph: {
      type: "website",
      url: content.path,
      title: `${content.title} | Nythera`,
      description: content.description
    }
  };
}

export function createTagLandingContent(tag: DiscoveryTag): SeoLandingContent {
  const label = tag.label;
  const lowerLabel = label.toLocaleLowerCase("en");
  const groupContext = {
    genre: "genre",
    tone: "mood and tone",
    relationship: "relationship dynamic",
    setting: "world and setting",
    fandom: "creative style",
    role: "character role"
  }[tag.group];

  return {
    path: `/tags/${tag.slug}`,
    eyebrow: `${label} / ${groupContext}`,
    title: `${label} AI roleplay characters`,
    description: `Discover ${lowerLabel} AI roleplay characters, scenarios, and story ideas in Nythera's public character archive.`,
    intro: [
      `Explore public ${lowerLabel} roleplay characters built for interactive dialogue and evolving stories. Each profile introduces the character, personality, scenario, and opening message before the chat begins.`,
      `This collection is organized around the ${groupContext} “${label}” and updates as creators publish new approved characters to Nythera.`
    ],
    highlights: [
      {
        title: `${label} character profiles`,
        description: "Review each character's premise, personality, scenario, greeting, and community response."
      },
      {
        title: "Start from the scene",
        description: "Open a character dossier and begin a story from its established roleplay foundation."
      },
      {
        title: "Keep exploring",
        description: "Move between related themes to find a different genre, tone, relationship, setting, or role."
      }
    ],
    relatedTags: []
  };
}
