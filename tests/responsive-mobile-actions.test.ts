import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("mobile navigation keeps its reserved row off chat surfaces", async () => {
  const [shell, dock] = await Promise.all([
    read("../src/components/layout/AppShell.tsx"),
    read("../src/components/nav/MobileDock.tsx")
  ]);

  assert.match(shell, /grid-rows-\[minmax\(0,1fr\)_auto\]/);
  assert.match(shell, /<MobileDock \/>/);
  assert.match(shell, /!isChatSurface \? \([\s\S]*<MobileDock \/>[\s\S]*\) : null/);
  assert.match(shell, /min-h-0 min-w-0 overflow-hidden/);
  assert.match(shell, /h-\[calc\(var\(--codex-mobile-dock-height\)\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(dock, /fixed inset-x-0 bottom-0/);
});

test("shared actions stack on phones and return to wrapped rows on larger screens", async () => {
  const source = await read("../src/components/ui/responsive-actions.tsx");

  assert.match(source, /grid-cols-1/);
  assert.match(source, /min-\[480px\]:grid-cols-2/);
  assert.match(source, /md:flex/);
  assert.match(source, /\[&>\*\]:w-full/);
});

test("mobile chat keeps primary actions and attempt navigation visible without the action sheet", async () => {
  const [bubble, menu] = await Promise.all([
    read("../src/components/chat/MessageBubble.tsx"),
    read("../src/components/chat/MessageContextMenu.tsx")
  ]);

  assert.match(bubble, /ActionButton label="More"/);
  assert.match(bubble, /ActionButton label="Skip time"[\s\S]*?className="sm:hidden"/);
  assert.match(bubble, /initialPanel=\{actionsPanel\}/);
  assert.match(bubble, /flex w-full flex-wrap items-center/);
  assert.match(bubble, /aria-label=\{`Version \$\{variantIndex! \+ 1\} of \$\{variantCount\}`\}/);
  assert.match(bubble, />Previous<\/button>/);
  assert.match(bubble, />Next<ChevronRight/);
  assert.doesNotMatch(menu, /Previous attempt|Next attempt/);
  assert.match(menu, /Branch/);
  assert.match(menu, /Report/);
  assert.match(menu, /Message actions/);
  assert.match(menu, /initialPanel = "actions"/);
  assert.match(menu, /grid-cols-4/);
});

test("story controls stay inside the phone viewport and scroll independently", async () => {
  const input = await read("../src/components/chat/ChatInput.tsx");

  assert.match(input, /max-h-\[min\(56dvh,36rem\)\]/);
  assert.match(input, /sm:max-h-\[min\(68dvh,40rem\)\]/);
  assert.match(input, /w-full min-w-0 max-w-\[var\(--chat-max-width\)\]/);
  assert.match(input, /overflow-x-hidden overflow-y-auto overscroll-contain/);
  assert.match(input, /aria-label="Close story controls"/);
});

test("phones stay portrait while tablets and larger devices keep their natural orientation", async () => {
  const [layout, manifest, nativeConfig, styles, orientationGuard] = await Promise.all([
    read("../src/app/layout.tsx"),
    read("../src/app/manifest.ts"),
    read("../mobile/app.json"),
    read("../src/app/globals.css"),
    read("../src/components/pwa/orientation-lock.tsx")
  ]);

  assert.doesNotMatch(manifest, /orientation:/);
  assert.match(nativeConfig, /"orientation": "default"/);
  assert.match(layout, /<OrientationLock \/>/);
  assert.match(styles, /\.portrait-guard\.is-blocked/);
  assert.match(orientationGuard, /shorterSide <= 540 && longerSide <= 932/);
  assert.doesNotMatch(orientationGuard, /navigator\.maxTouchPoints|pointer: coarse/);
  assert.match(orientationGuard, /if \(!isPhoneDevice\(\)\)/);
  assert.match(orientationGuard, /orientation\?\.unlock\?\.\(\)/);
  assert.match(orientationGuard, /orientation\.lock\("portrait-primary"\)/);
  assert.doesNotMatch(layout, /LivingCodexIntro|living-codex-intro/);
  assert.doesNotMatch(styles, /\.living-codex-intro|@keyframes living-codex-copy/);
});
