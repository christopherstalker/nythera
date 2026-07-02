export type DiscoveryTag = {
  label: string;
  slug: string;
  group: "genre" | "tone" | "relationship" | "setting" | "fandom" | "role";
  aliases?: string[];
};

export const MAX_CHARACTER_TAGS = 12;

export const DISCOVERY_TAGS: DiscoveryTag[] = [
  { label: "Adventure", slug: "adventure", group: "genre" },
  { label: "Anime", slug: "anime", group: "fandom" },
  { label: "Fantasy", slug: "fantasy", group: "genre" },
  { label: "Sci-Fi", slug: "sci-fi", group: "genre", aliases: ["sci fi", "science fiction"] },
  { label: "RPG", slug: "rpg", group: "genre", aliases: ["roleplay", "role-play"] },
  { label: "Romance", slug: "romance", group: "relationship" },
  { label: "Slow Burn", slug: "slow-burn", group: "relationship" },
  { label: "Enemies to Lovers", slug: "enemies-to-lovers", group: "relationship", aliases: ["enemy", "rivals"] },
  { label: "Friendship", slug: "friendship", group: "relationship" },
  { label: "Mentor", slug: "mentor", group: "role", aliases: ["mentor/coach", "coach"] },
  { label: "Villain", slug: "villain", group: "role", aliases: ["antagonist"] },
  { label: "Companion", slug: "companion", group: "role" },
  { label: "Slice of Life", slug: "slice-of-life", group: "genre", aliases: ["slice of life"] },
  { label: "Comedy", slug: "comedy", group: "tone" },
  { label: "Drama", slug: "drama", group: "tone" },
  { label: "Mystery / Noir", slug: "mystery-noir", group: "genre", aliases: ["mystery", "noir", "mystery/noir"] },
  { label: "Horror", slug: "horror", group: "genre" },
  { label: "Supernatural", slug: "supernatural", group: "genre" },
  { label: "Historical", slug: "historical-fiction", group: "setting", aliases: ["historical", "period drama"] },
  { label: "Cyberpunk", slug: "cyberpunk", group: "setting", aliases: ["neon"] },
  { label: "Urban Fantasy", slug: "urban-fantasy", group: "setting" },
  { label: "Dark Academia", slug: "dark-academia", group: "setting", aliases: ["academic"] },
  { label: "Space Opera", slug: "space-opera", group: "setting" },
  { label: "Cozy", slug: "cozy", group: "tone", aliases: ["comfort"] },
  { label: "Angst", slug: "angst", group: "tone", aliases: ["melancholic"] },
  { label: "Wholesome", slug: "wholesome", group: "tone", aliases: ["caring", "tender", "healing"] },
  { label: "Action", slug: "action", group: "genre" },
  { label: "Survival", slug: "survival", group: "genre" },
  { label: "Monster", slug: "monster", group: "role" },
  { label: "Detective", slug: "detective", group: "role" }
];

export function slugifyTag(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/&/g, " and ")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function normalizeCharacterTag(value: string) {
  const slug = slugifyTag(value);
  const match = DISCOVERY_TAGS.find((tag) => {
    const aliases = [tag.slug, tag.label, ...(tag.aliases ?? [])].map(slugifyTag);
    return aliases.includes(slug);
  });

  return match?.slug ?? slug;
}

export function normalizeCharacterTags(values: string[]) {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const value of values) {
    const normalized = normalizeCharacterTag(value);
    if (normalized.length < 2 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    tags.push(normalized);
    if (tags.length >= MAX_CHARACTER_TAGS) {
      break;
    }
  }

  return tags;
}

export function expandTagQuery(value: string) {
  const slug = slugifyTag(value);
  const tag = DISCOVERY_TAGS.find((item) => {
    const aliases = [item.slug, item.label, ...(item.aliases ?? [])].map(slugifyTag);
    return aliases.includes(slug);
  });

  return Array.from(new Set([value.trim(), slug, tag?.slug, tag?.label, ...(tag?.aliases ?? [])].filter(Boolean) as string[]));
}

export function displayTagLabel(value: string) {
  const slug = slugifyTag(value);
  const match = DISCOVERY_TAGS.find((tag) => tag.slug === slug || tag.aliases?.map(slugifyTag).includes(slug));
  if (match) {
    return match.label;
  }

  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}
