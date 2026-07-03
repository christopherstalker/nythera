import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("chat context is a glass side panel that becomes an overlay drawer on active chat", async () => {
  const panel = await read("../src/components/panel/SidePanel.tsx");

  assert.match(panel, /Story context/);
  assert.match(panel, /glass-grain/);
  assert.match(panel, /useTabletGlassFallback/);
  assert.match(panel, /usePathname/);
  assert.match(panel, /isChatSurface/);
  assert.match(panel, /backdropFilter:\s*isTablet \? "none" : "blur\(20px\) saturate\(180%\)"/);
  assert.match(panel, /<nav[\s\S]*?aria-label="Story context"/);
  assert.match(panel, /grid-cols-3/);
  assert.match(panel, /Persona[\s\S]*Memory[\s\S]*Chats/);
  assert.doesNotMatch(panel, /!isChatSurface && "xl:translate-x-0"/);
  assert.doesNotMatch(panel, /!isChatSurface && "xl:hidden"/);
  assert.match(panel, /isChatSurface && "top-0 xl:top-0 xl:h-full"/);
  assert.doesNotMatch(panel, /xl:static/);
  assert.doesNotMatch(panel, /w-\[68px\][\s\S]*border-r/);
});

test("chat uses immersive story cards, compact user pills, and a reference-style composer", async () => {
  const bubble = await read("../src/components/chat/MessageBubble.tsx");
  const header = await read("../src/components/chat/ChatHeader.tsx");
  const composer = await read("../src/components/chat/ChatInput.tsx");
  const list = await read("../src/components/chat/MessageList.tsx");
  const client = await read("../src/components/chat/chat-client.tsx");
  const store = await read("../src/stores/use-ui-store.ts");

  assert.match(header, /motion\.header/);
  assert.match(header, /max-w-\[min\(920px,calc\(100vw-1\.5rem\)\)\]/);
  assert.match(header, /var\(--bg-base\) 8%, transparent/);
  assert.match(header, /blur\(8px\) saturate\(115%\)/);
  assert.match(header, /personaName/);
  assert.match(header, /contextOpen/);
  assert.match(header, /Close story context/);
  assert.match(header, /PanelRightClose/);
  assert.match(client, /toggleSidePanel/);
  assert.match(client, /onOpenContext=\{toggleSidePanel\}/);
  assert.match(store, /toggleSidePanel:\s*\(\) => void/);
  assert.match(store, /sidePanelOpen:\s*!state\.sidePanelOpen/);
  assert.doesNotMatch(bubble, /<CharacterAvatar/);
  assert.match(bubble, /w-full rounded-\[28px\]/);
  assert.match(bubble, /text-\[26px\] font-bold/);
  assert.match(bubble, /max-w-\[min\(88%,640px\)\]/);
  assert.match(bubble, /var\(--accent-purple\) 24%, transparent/);
  assert.match(bubble, /border-white\/20 bg-white\/\[0\.06\] text-\[var\(--text-primary\)\]/);
  assert.match(bubble, /color-mix\(in oklch, var\(--bg-base\) 92%, transparent\)/);
  assert.match(bubble, /isLatestAssistant/);
  assert.match(bubble, /group-hover\/message:opacity-100/);
  assert.match(list, /latestAssistantId/);
  assert.doesNotMatch(list, /xl:pr-\[calc\(var\(--side-panel-width\)\+24px\)\]/);
  assert.match(client, /chat-scene-art/);
  assert.match(client, /background:\s*"transparent"/);
  assert.match(composer, /composer-dock/);
  assert.match(composer, /sticky bottom-0/);
  assert.match(composer, /rounded-\[36px\]/);
  assert.doesNotMatch(composer, /shadow-\[var\(--shadow-elevated\)\]/);
  assert.match(composer, /background: "transparent"/);
  assert.match(composer, /var\(--bg-surface\) 4%, transparent/);
  assert.match(composer, /ArrowUp/);
  assert.match(composer, /gradient-aurora-primary/);
  assert.doesNotMatch(composer, /bg-primary/);
  assert.match(composer, /Send a message/);
  assert.match(composer, /max-h-\[220px\]/);
});

test("chat library uses a featured scene plus an earlier-conversation stream", async () => {
  const chats = await read("../src/app/(main)/chats/page.tsx");

  assert.match(chats, /Continue your latest scene/);
  assert.match(chats, /Earlier conversations/);
  assert.match(chats, /chats\[0\]/);
  assert.match(chats, /chats\.slice\(1\)/);
  assert.doesNotMatch(chats, /glass-card glass-card-hover/);
});
