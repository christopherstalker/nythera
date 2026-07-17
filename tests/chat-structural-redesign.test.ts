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
  assert.match(panel, /side-panel orbital-functional/);
  assert.match(panel, /isTablet && "orbital-tablet-solid"/);
  assert.match(panel, /<nav[\s\S]*?aria-label="Story context"/);
  assert.match(panel, /grid-cols-3/);
  assert.match(panel, /Persona[\s\S]*Memory[\s\S]*Chats/);
  assert.doesNotMatch(panel, /!isChatSurface && "xl:translate-x-0"/);
  assert.doesNotMatch(panel, /!isChatSurface && "xl:hidden"/);
  assert.match(panel, /isChatSurface && "top-0 xl:top-0 xl:h-full"/);
  assert.doesNotMatch(panel, /xl:static/);
  assert.doesNotMatch(panel, /w-\[68px\][\s\S]*border-r/);
});

test("chat uses an editorial dossier workspace, manuscript messages, and a reference-style composer", async () => {
  const bubble = await read("../src/components/chat/MessageBubble.tsx");
  const header = await read("../src/components/chat/ChatHeader.tsx");
  const composer = await read("../src/components/chat/ChatInput.tsx");
  const list = await read("../src/components/chat/MessageList.tsx");
  const client = await read("../src/components/chat/chat-client.tsx");
  const store = await read("../src/stores/use-ui-store.ts");

  assert.match(header, /motion\.header/);
  assert.match(header, /max-w-\[1100px\]/);
  assert.match(header, /orbital-floating/);
  assert.match(header, /personaName/);
  assert.match(header, /contextOpen/);
  assert.match(header, /Close story context/);
  assert.match(header, /PanelRightClose/);
  assert.match(client, /toggleSidePanel/);
  assert.match(client, /onOpenContext=\{toggleSidePanel\}/);
  assert.match(store, /toggleSidePanel:\s*\(\) => void/);
  assert.match(store, /sidePanelOpen:\s*!state\.sidePanelOpen/);
  assert.match(bubble, /characterAvatarUrl/);
  assert.match(bubble, /personaAvatarUrl/);
  assert.match(bubble, /grid-cols-\[42px_minmax\(0,1fr\)\]/);
  assert.match(bubble, /border-b border-\[var\(--codex-rule\)\]/);
  assert.match(bubble, /font-editorial relative max-w-\[760px\]/);
  assert.match(bubble, /isLatestAssistant/);
  assert.match(bubble, /group-hover\/message:opacity-100/);
  assert.match(list, /latestAssistantId/);
  assert.doesNotMatch(list, /xl:pr-\[calc\(var\(--side-panel-width\)\+24px\)\]/);
  assert.match(client, /chat-codex-workspace/);
  assert.match(client, /lg:grid-cols-\[minmax\(260px,300px\)_minmax\(0,1fr\)\]/);
  assert.match(client, /Chapter 3/);
  assert.match(composer, /composer-dock/);
  assert.match(composer, /sticky bottom-0/);
  assert.match(composer, /border border-\[var\(--codex-rule\)\]/);
  assert.doesNotMatch(composer, /shadow-\[var\(--shadow-elevated\)\]/);
  assert.match(composer, /bg-\[var\(--codex-paper-raised\)\]/);
  assert.match(composer, /ArrowUp/);
  assert.match(composer, /border border-\[var\(--codex-mint\)\]/);
  assert.match(composer, /Write what happens next/);
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
