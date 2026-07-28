import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("home renders current Living Codex content in the initial server response", async () => {
  const [page, client, serviceWorker] = await Promise.all([
    read("../src/app/page.tsx"),
    read("../src/components/home/home-page-client.tsx"),
    read("../public/sw.js")
  ]);

  assert.match(page, /getPublicCharacters/);
  assert.match(page, /getRecentChats/);
  assert.match(client, /Featured story · Volume I/);
  assert.doesNotMatch(client, /HomeLoading|bg-aurora-ambient|rounded-\[20px\]/);
  assert.match(serviceWorker, /request\.mode === "navigate"[\s\S]*?fetch\(request\)[\s\S]*?caches\.match\("\/offline\.html"\)/);
  assert.match(serviceWorker, /nythera-codex-v2/);
});
