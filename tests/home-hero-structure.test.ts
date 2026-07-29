import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Home featured character uses a split editorial stage", async () => {
  const source = await readFile(new URL("../src/components/home/home-page-client.tsx", import.meta.url), "utf8");
  const heroStart = source.indexOf("function FeaturedCharacterHero");
  const nextComponent = source.indexOf("function RecentChatCard", heroStart);

  assert.ok(heroStart > -1, "expected a dedicated FeaturedCharacterHero component");
  assert.ok(nextComponent > heroStart, "expected the hero component to have a bounded source section");

  const hero = source.slice(heroStart, nextComponent);
  assert.match(source, /<PageShell[\s\S]*?<FeaturedCharacterHero/, "hero must live inside the editorial page frame");
  assert.match(hero, /codex-featured-stage/);
  assert.match(hero, /lg:grid-cols-\[minmax\(340px,.82fr\)_minmax\(0,1.3fr\)\]/);
  assert.match(hero, /absolute inset-0 h-full w-full object-cover/);
  assert.match(hero, /Featured story · Volume I/);
  assert.match(hero, /<h2[\s\S]*?\{character\.name\}/);
  assert.match(source, /function HomeSeoIntro[\s\S]*?<h1[\s\S]*?Stories that remember you\./);
  assert.match(hero, /<Button[^>]*size="lg"[^>]*onClick=\{onStartChat\}/);
  assert.doesNotMatch(hero, /app-surface|blur-2xl|#[\da-f]{3,8}/i);
});
