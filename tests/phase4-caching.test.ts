import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public character catalog requests use the shared cached discovery query", async () => {
  const route = await readFile(new URL("../src/app/api/characters/route.ts", import.meta.url), "utf8");
  const discoveryFeed = await readFile(new URL("../src/lib/discovery-feed.ts", import.meta.url), "utf8");

  assert.match(discoveryFeed, /unstable_cache/);
  assert.match(discoveryFeed, /DISCOVERY_FEED_REVALIDATE_SECONDS\s*=\s*60/);
  assert.match(discoveryFeed, /shouldCachePublicCharacterQuery/);
  assert.match(route, /getPublicCharacters\(query\)/);
  assert.match(route, /discoveryFeedCacheHeaders\(\)/);
  assert.match(discoveryFeed, /s-maxage/);
});

test("provider pricing remains a static table, not a per-message lookup", async () => {
  const pricing = await readFile(new URL("../src/lib/model-pricing.ts", import.meta.url), "utf8");

  assert.match(pricing, /export const MODEL_PRICING/);
  assert.doesNotMatch(pricing, /fetch\(/);
  assert.doesNotMatch(pricing, /prisma\./);
  assert.doesNotMatch(pricing, /unstable_cache/);
});

test("character image surfaces use Next image caching when source URLs are cacheable", async () => {
  const nextConfig = await readFile(new URL("../next.config.mjs", import.meta.url), "utf8");
  const characterCard = await readFile(new URL("../src/components/characters/CharacterCard.tsx", import.meta.url), "utf8");
  const homePage = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(nextConfig, /minimumCacheTTL:\s*86400/);
  assert.match(characterCard, /shouldBypassNextImageOptimization/);
  assert.match(homePage, /shouldBypassNextImageOptimization/);
  assert.doesNotMatch(characterCard, /\bunoptimized\b(?!\s*=)/);
  assert.doesNotMatch(homePage, /\bunoptimized\b(?!\s*=)/);
});
