import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("help center exposes platform, API, formatting, and support routes", async () => {
  const [guide, navigation] = await Promise.all([
    readFile(new URL("../src/app/guide/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/guide/guide-navigation.tsx", import.meta.url), "utf8")
  ]);

  for (const route of ["/guide/platform", "/guide/api", "/guide/roleplay-formatting", "/support"]) {
    assert.match(guide, new RegExp(route.replaceAll("/", "\\/")));
    assert.match(navigation, new RegExp(route.replaceAll("/", "\\/")));
  }
});

test("API manual documents the shared provider catalog without advertising internal routes", async () => {
  const source = await readFile(new URL("../src/app/guide/api/page.tsx", import.meta.url), "utf8");

  assert.match(source, /FIRST_CLASS_PROVIDER_PRESETS\.map/);
  assert.match(source, /not a public Nythera REST API/);
  assert.doesNotMatch(source, /\/api\/chats\/\[id\]/);
});

test("support email and request categories use one shared source of truth", async () => {
  const [support, form, rail, settings] = await Promise.all([
    readFile(new URL("../src/lib/support.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/support/support-email-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/nav/navigation-items.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(main)/settings/page.tsx", import.meta.url), "utf8")
  ]);

  assert.match(support, /support@nythera\.art/);
  assert.match(form, /mailto:\$\{SUPPORT_EMAIL\}/);
  assert.doesNotMatch(form, /support@nythera\.art/);
  assert.match(rail, /href: "\/guide", label: "Help"/);
  assert.match(settings, /href="\/support"/);
});

test("public help routes are discoverable in the sitemap", async () => {
  const sitemap = await readFile(new URL("../src/app/sitemap.ts", import.meta.url), "utf8");

  for (const route of ["/guide", "/guide/platform", "/guide/api", "/support"]) {
    assert.match(sitemap, new RegExp(`"${route}"`));
  }
});
