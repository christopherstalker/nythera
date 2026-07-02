import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import postcss from "postcss";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

function rulesFor(root: postcss.Root, selector: string) {
  const matches: postcss.Rule[] = [];
  root.walkRules(selector, (rule) => {
    matches.push(rule);
  });
  return matches;
}

test("the default discovery feed uses a dedicated bento component", async () => {
  const [explore, card, bento] = await Promise.all([
    read("../src/app/(main)/explore/page.tsx"),
    read("../src/components/characters/CharacterCard.tsx"),
    read("../src/components/characters/CharacterBentoGrid.tsx")
  ]);

  assert.match(explore, /import \{ CharacterBentoGrid \}/);
  assert.match(explore, /<CharacterBentoGrid/);
  assert.doesNotMatch(explore, /<CharacterRow/);
  assert.match(card, /discoveryPlacement\?: "STANDARD" \| "FEATURED" \| "WIDE"/);
  assert.match(bento, /nythera-bento-featured/);
  assert.match(bento, /nythera-bento-wide/);
  assert.match(bento, /bentoCellClass\(character\.discoveryPlacement\)/);
  assert.doesNotMatch(bento, /bentoCellClass\(index/);
  assert.match(bento, /SkeletonCard/);
  assert.match(bento, /CharacterCard/);
});

test("bento spans activate only on desktop and collapse to a uniform responsive grid", async () => {
  const globals = await read("../src/app/globals.css");

  assert.match(globals, /\.nythera-bento-grid\s*\{[\s\S]*grid-template-columns:\s*1fr;[\s\S]*grid-auto-rows:\s*260px/);
  assert.match(globals, /@media \(min-width:\s*768px\)[\s\S]*\.nythera-bento-grid\s*\{[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(globals, /@media \(min-width:\s*1280px\)[\s\S]*\.nythera-bento-grid\s*\{[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(globals, /\.nythera-bento-card\s*\{[\s\S]*height:\s*100%/);

  const root = postcss.parse(globals);
  for (const selector of [".nythera-bento-featured", ".nythera-bento-wide"]) {
    const rules = rulesFor(root, selector);
    assert.equal(rules.length, 1, `${selector} should have one placement rule`);
    assert.equal(rules[0].parent?.type, "atrule");
    assert.equal((rules[0].parent as postcss.AtRule).params, "(min-width: 1280px)");
  }

  const featured = rulesFor(root, ".nythera-bento-featured")[0];
  const declarations = featured.nodes.filter((node): node is postcss.Declaration => node.type === "decl");
  assert.equal(declarations.find((node) => node.prop === "grid-column")?.value, "span 2");
  assert.equal(declarations.find((node) => node.prop === "grid-row")?.value, "span 2");
});
