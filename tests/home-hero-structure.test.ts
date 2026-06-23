import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Home featured character uses a full-bleed aurora media hero", async () => {
  const source = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const heroStart = source.indexOf("function FeaturedCharacterHero");
  const nextComponent = source.indexOf("function RecentChatCard", heroStart);

  assert.ok(heroStart > -1, "expected a dedicated FeaturedCharacterHero component");
  assert.ok(nextComponent > heroStart, "expected the hero component to have a bounded source section");

  const hero = source.slice(heroStart, nextComponent);
  assert.match(source, /<FeaturedCharacterHero[\s\S]*?<PageShell/, "hero must render outside the padded PageShell");
  assert.match(hero, /<section[\s\S]*?min-h-\[clamp\(/);
  assert.match(hero, /absolute inset-0 -z-30 h-full w-full object-cover/);
  assert.match(hero, /bg-aurora-primary/);
  assert.match(hero, /<h1[\s\S]*?\{character\.name\}/);
  assert.match(hero, /<Button[^>]*size="lg"[^>]*onClick=\{onStartChat\}/);
  assert.doesNotMatch(hero, /app-surface|blur-2xl|Featured character|#[\da-f]{3,8}/i);
});
