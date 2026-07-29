import "server-only";

import { cache } from "react";
import { getPublicCharacters, normalizePublicCharacterQuery } from "@/lib/discovery-feed";

export const getSeoCharactersForTags = cache(async (tagKey: string, take = 18) => {
  const tags = tagKey.split(",").map((tag) => tag.trim()).filter(Boolean);
  return getPublicCharacters(normalizePublicCharacterQuery({
    tags,
    take,
    sort: "trending",
    nsfw: "safe"
  }));
});
