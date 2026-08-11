import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("public profiles render an authored creator archive with responsive character layouts", async () => {
  const [profile, page] = await Promise.all([
    read("../src/components/profile/public-profile-view.tsx"),
    read("../src/app/u/[username]/page.tsx")
  ]);

  assert.match(profile, /Nythera \/ Creator archive/);
  assert.match(profile, /Character archive/);
  assert.match(profile, /sm:grid-cols-2 lg:grid-cols-3/);
  assert.match(profile, /md:grid-cols-\[minmax\(240px,.85fr\)_minmax\(0,1.15fr\)\]/);
  assert.match(profile, /navigator\.share/);
  assert.match(page, /<PageShell className="max-w-6xl">/);
});

test("public profile empty states distinguish owner and visitor guidance", async () => {
  const profile = await read("../src/components/profile/public-profile-view.tsx");

  assert.match(profile, /Publish a character to begin building your public collection\./);
  assert.match(profile, /No public characters have been released yet\./);
});
