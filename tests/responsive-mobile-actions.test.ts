import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("mobile navigation owns a layout row instead of overlaying page actions", async () => {
  const [shell, dock] = await Promise.all([
    read("../src/components/layout/AppShell.tsx"),
    read("../src/components/nav/MobileDock.tsx")
  ]);

  assert.match(shell, /grid-rows-\[minmax\(0,1fr\)_auto\]/);
  assert.match(shell, /<MobileDock \/>/);
  assert.match(shell, /min-h-0 min-w-0 overflow-hidden/);
  assert.doesNotMatch(shell, /pb-\[calc\(var\(--codex-mobile-dock-height\)/);
  assert.match(dock, /relative z-50 grid/);
  assert.doesNotMatch(dock, /fixed inset-x-0 bottom-0/);
});

test("shared actions stack on phones and return to wrapped rows on larger screens", async () => {
  const source = await read("../src/components/ui/responsive-actions.tsx");

  assert.match(source, /grid-cols-1/);
  assert.match(source, /min-\[480px\]:grid-cols-2/);
  assert.match(source, /md:flex/);
  assert.match(source, /\[&>\*\]:w-full/);
});

test("mobile chat keeps primary actions visible and moves the rest into the action sheet", async () => {
  const [bubble, menu] = await Promise.all([
    read("../src/components/chat/MessageBubble.tsx"),
    read("../src/components/chat/MessageContextMenu.tsx")
  ]);

  assert.match(bubble, /ActionButton label="More actions"/);
  assert.match(bubble, /max-sm:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)_2\.75rem\]/);
  assert.match(menu, /Previous attempt/);
  assert.match(menu, /Branch/);
  assert.match(menu, /Report/);
  assert.match(menu, /max-h-\[min\(80dvh,42rem\)\]/);
});

test("installed app surfaces request portrait while browser layout remains responsive", async () => {
  const [manifest, nativeConfig, lock] = await Promise.all([
    read("../src/app/manifest.ts"),
    read("../mobile/app.json"),
    read("../src/components/pwa/orientation-lock.tsx")
  ]);

  assert.match(manifest, /orientation: "portrait-primary"/);
  assert.match(nativeConfig, /"orientation": "portrait"/);
  assert.match(lock, /display-mode: standalone/);
  assert.match(lock, /orientation\.lock\("portrait-primary"\)/);
});
